"""
main.py
-------
FastAPI backend application for the Automated Notebook Grading System.
Provides endpoints for:
- Authentication (JWT login, profile)
- Assignments inspection
- Student submission upload (with deadline checks and server-side student isolation)
- Student self-service grade retrieval (filtered strictly by authenticated user ID)
- Admin assignment grades dashboard
- Admin manual grade adjustments
- Admin pipeline trigger (invoking Phase 5's LangGraph batch grading)
"""

import logging
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import (
    BackgroundTasks,
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth import (
    create_access_token,
    get_current_user,
    require_admin,
    require_student,
    verify_password,
)
from app.config import get_settings
from app.database import get_db
from app.models import (
    Assignment,
    Grade,
    Student,
    Submission,
    SubmissionStatus,
    UserRole,
)
from app.pipeline import run_grading_pipeline
from app.schemas import (
    AdminGradeItem,
    AssignmentCreateRequest,
    AssignmentResponse,
    GradePatchRequest,
    LoginRequest,
    StudentGradeView,
    SubmissionResponse,
    TokenResponse,
    TriggerGradingResponse,
    UserResponse,
)

logger = logging.getLogger("app.main")
settings = get_settings()

app = FastAPI(
    title="Notebook Grading System API",
    description="Automated grading and plagiarism detection system for machine learning lab assignments",
    version="0.1.0",
)

# ── CORS Middleware ───────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # configure specific domains in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health Check ──────────────────────────────────────────────────────────────

@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "environment": settings.ENVIRONMENT}


# ── Authentication Endpoints ──────────────────────────────────────────────────

@app.post("/auth/login", response_model=TokenResponse, tags=["Auth"])
async def login(
    payload: LoginRequest,
    session: AsyncSession = Depends(get_db),
):
    """
    Authenticates a student or admin user with email and password.
    Returns a JWT access token containing the user's role and ID.
    """
    stmt = select(Student).where(Student.email == payload.email)
    res = await session.execute(stmt)
    user = res.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role.value}
    )

    return TokenResponse(
        access_token=access_token,
        role=user.role.value,
        user_id=user.id,
        name=user.name,
        email=user.email,
    )


@app.get("/auth/me", response_model=UserResponse, tags=["Auth"])
async def get_my_profile(current_user: Student = Depends(get_current_user)):
    """Returns the profile of the currently authenticated user."""
    return current_user


# ── Assignments Endpoints ─────────────────────────────────────────────────────

@app.get("/assignments", response_model=List[AssignmentResponse], tags=["Assignments"])
async def list_assignments(
    session: AsyncSession = Depends(get_db),
    current_user: Student = Depends(get_current_user),
):
    """Lists all available assignments."""
    stmt = select(Assignment).order_by(Assignment.deadline.asc())
    res = await session.execute(stmt)
    return res.scalars().all()


@app.get("/assignments/{id}", response_model=AssignmentResponse, tags=["Assignments"])
async def get_assignment(
    id: int,
    session: AsyncSession = Depends(get_db),
    current_user: Student = Depends(get_current_user),
):
    """Fetches details of a single assignment by ID."""
    assignment = await session.get(Assignment, id)
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    return assignment


@app.post(
    "/admin/assignments",
    response_model=AssignmentResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Admin"],
)
async def create_assignment(
    payload: AssignmentCreateRequest,
    session: AsyncSession = Depends(get_db),
    admin_user: Student = Depends(require_admin),
):
    """
    Creates a new assignment with rubric criteria, task description, max marks, and deadline.
    Restricted to Admin/TA users.
    """
    assignment = Assignment(
        title=payload.title,
        description=payload.description,
        rubric_text=payload.rubric_text,
        max_marks=payload.max_marks,
        deadline=payload.deadline,
    )
    session.add(assignment)
    await session.commit()
    await session.refresh(assignment)
    logger.info(
        "Admin %s (id=%d) created assignment id=%d: '%s'",
        admin_user.name, admin_user.id, assignment.id, assignment.title,
    )
    return assignment


# ── Student Endpoints ─────────────────────────────────────────────────────────

@app.post("/submissions/upload", response_model=SubmissionResponse, tags=["Submissions"])
async def upload_submission(
    assignment_id: int = Form(...),
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db),
    current_user: Student = Depends(get_current_user),
):
    """
    Student uploads their .ipynb notebook for an assignment before the deadline.
    Stores the file and creates/updates a submission row with status='pending'.
    """
    # 1. Validate file format
    if not file.filename or not file.filename.endswith(".ipynb"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only Jupyter notebook files (.ipynb) are allowed.",
        )

    # 2. Check assignment exists and deadline
    assignment = await session.get(Assignment, assignment_id)
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    now_utc = datetime.now(timezone.utc)
    if now_utc > assignment.deadline:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Assignment deadline passed on {assignment.deadline.isoformat()}.",
        )

    # 3. Check for existing submission
    sub_stmt = select(Submission).where(
        Submission.assignment_id == assignment_id,
        Submission.student_id == current_user.id,
    )
    existing_sub = (await session.execute(sub_stmt)).scalar_one_or_none()

    if existing_sub and existing_sub.status in (SubmissionStatus.graded, SubmissionStatus.processing):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot overwrite submission: already in '{existing_sub.status.value}' state.",
        )

    # 4. Save file to storage
    upload_dir = Path(settings.UPLOAD_DIR) / f"assignment_{assignment_id}"
    upload_dir.mkdir(parents=True, exist_ok=True)
    clean_filename = Path(file.filename).name
    saved_path = upload_dir / f"student_{current_user.id}_{clean_filename}"

    with open(saved_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 5. Persist submission record
    if existing_sub:
        existing_sub.file_path = str(saved_path.resolve())
        existing_sub.submitted_at = now_utc
        existing_sub.status = SubmissionStatus.pending
        submission_obj = existing_sub
    else:
        submission_obj = Submission(
            assignment_id=assignment_id,
            student_id=current_user.id,
            file_path=str(saved_path.resolve()),
            submitted_at=now_utc,
            status=SubmissionStatus.pending,
        )
        session.add(submission_obj)

    await session.commit()
    await session.refresh(submission_obj)
    return submission_obj


@app.get("/students/me/grades", response_model=List[StudentGradeView], tags=["Students"])
async def get_my_grades(
    session: AsyncSession = Depends(get_db),
    current_user: Student = Depends(get_current_user),
):
    """
    CRITICAL SECURITY REQUIREMENT:
    Returns ONLY the authenticated student's own grades.
    Filtered strictly server-side by current_user.id — never trusts a client-provided student_id.
    """
    stmt = (
        select(Submission)
        .where(Submission.student_id == current_user.id)
        .options(selectinload(Submission.assignment), selectinload(Submission.grade))
        .order_by(desc(Submission.submitted_at))
    )
    result = await session.execute(stmt)
    submissions = result.scalars().all()

    views: List[StudentGradeView] = []
    for sub in submissions:
        grade = sub.grade
        views.append(
            StudentGradeView(
                submission_id=sub.id,
                assignment_id=sub.assignment_id,
                assignment_title=sub.assignment.title if sub.assignment else "Unknown Assignment",
                status=sub.status.value,
                marks=grade.marks if grade else None,
                max_marks=grade.max_marks if grade else None,
                reasoning_text=grade.reasoning_text if grade else None,
                submitted_at=sub.submitted_at,
                graded_at=grade.graded_at if grade else None,
            )
        )
    return views


# ── Admin Endpoints ───────────────────────────────────────────────────────────

@app.get(
    "/admin/assignments/{id}/grades",
    response_model=List[AdminGradeItem],
    tags=["Admin"],
)
async def get_assignment_grades_for_admin(
    id: int,
    session: AsyncSession = Depends(get_db),
    admin_user: Student = Depends(require_admin),
):
    """
    Admin views full table of submissions and grades for a specific assignment:
    student details, marks, reasoning, flagged status, and manual edit audit trail.
    """
    # Verify assignment exists
    assignment = await session.get(Assignment, id)
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    stmt = (
        select(Submission)
        .where(Submission.assignment_id == id)
        .options(selectinload(Submission.student), selectinload(Submission.grade))
        .order_by(Submission.id.asc())
    )
    result = await session.execute(stmt)
    submissions = result.scalars().all()

    items: List[AdminGradeItem] = []
    for sub in submissions:
        grade = sub.grade
        items.append(
            AdminGradeItem(
                grade_id=grade.id if grade else None,
                submission_id=sub.id,
                student_id=sub.student_id,
                student_name=sub.student.name if sub.student else "Unknown",
                student_email=sub.student.email if sub.student else "Unknown",
                assignment_id=sub.assignment_id,
                marks=grade.marks if grade else None,
                max_marks=grade.max_marks if grade else None,
                reasoning_text=grade.reasoning_text if grade else None,
                flagged=grade.flagged if grade else False,
                flag_reason=grade.flag_reason if grade else None,
                submission_status=sub.status.value,
                submitted_at=sub.submitted_at,
                graded_at=grade.graded_at if grade else None,
                manually_edited=grade.manually_edited if grade else False,
                edited_by_admin_id=grade.edited_by_admin_id if grade else None,
                edited_at=grade.edited_at if grade else None,
            )
        )
    return items


@app.patch("/admin/grades/{id}", response_model=AdminGradeItem, tags=["Admin"])
async def edit_grade_manually(
    id: int,
    payload: GradePatchRequest,
    session: AsyncSession = Depends(get_db),
    admin_user: Student = Depends(require_admin),
):
    """
    Admin manually updates a grade (marks, reasoning, or similarity flag).
    Records manually_edited=true, edited_by_admin_id, and edited_at timestamp.
    """
    grade = await session.get(Grade, id)
    if not grade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grade not found")

    sub = await session.get(Submission, grade.submission_id)
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Associated submission not found")

    student = await session.get(Student, sub.student_id)

    # Apply updates
    if payload.marks is not None:
        clamped_marks = max(0.0, min(payload.marks, grade.max_marks))
        grade.marks = clamped_marks

    if payload.reasoning_text is not None:
        grade.reasoning_text = payload.reasoning_text

    if payload.flagged is not None:
        grade.flagged = payload.flagged
        if not payload.flagged:
            grade.flag_reason = None
            sub.status = SubmissionStatus.graded
        else:
            sub.status = SubmissionStatus.flagged

    if payload.flag_reason is not None:
        grade.flag_reason = payload.flag_reason

    grade.manually_edited = True
    grade.edited_by_admin_id = admin_user.id
    grade.edited_at = datetime.now(timezone.utc)

    await session.commit()
    await session.refresh(grade)
    await session.refresh(sub)

    return AdminGradeItem(
        grade_id=grade.id,
        submission_id=sub.id,
        student_id=sub.student_id,
        student_name=student.name if student else "Unknown",
        student_email=student.email if student else "Unknown",
        assignment_id=sub.assignment_id,
        marks=grade.marks,
        max_marks=grade.max_marks,
        reasoning_text=grade.reasoning_text,
        flagged=grade.flagged,
        flag_reason=grade.flag_reason,
        submission_status=sub.status.value,
        submitted_at=sub.submitted_at,
        graded_at=grade.graded_at,
        manually_edited=grade.manually_edited,
        edited_by_admin_id=grade.edited_by_admin_id,
        edited_at=grade.edited_at,
    )


@app.post(
    "/admin/assignments/{id}/trigger-grading",
    response_model=TriggerGradingResponse,
    tags=["Admin"],
)
async def trigger_grading_pipeline(
    id: int,
    direct: bool = False,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    session: AsyncSession = Depends(get_db),
    admin_user: Student = Depends(require_admin),
):
    """
    Triggers Phase 5's LangGraph batch grading pipeline for an assignment.
    Processes all pending submissions through preprocessing, similarity checking,
    batch LLM evaluation, and database persistence.
    """
    assignment = await session.get(Assignment, id)
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    # Count pending submissions
    stmt = select(Submission).where(
        Submission.assignment_id == id,
        Submission.status.in_([SubmissionStatus.pending, SubmissionStatus.processing]),
    )
    pending_subs = (await session.execute(stmt)).scalars().all()
    count = len(pending_subs)

    if count == 0:
        return TriggerGradingResponse(
            message="No pending submissions found for this assignment.",
            assignment_id=id,
            status="idle",
            details={"pending_count": 0},
        )

    # Launch pipeline
    if direct:
        # Synchronous/direct execution (e.g. for testing)
        state = await run_grading_pipeline(assignment_id=id, direct_execution=True)
        return TriggerGradingResponse(
            message=f"Grading pipeline completed for {count} submission(s).",
            assignment_id=id,
            status="completed" if state.get("completed") else "failed",
            details={"processed": count, "errors": state.get("errors", [])},
        )
    else:
        # Background task for Message Batches API
        background_tasks.add_task(run_grading_pipeline, assignment_id=id)
        return TriggerGradingResponse(
            message=f"Grading pipeline triggered for {count} submission(s).",
            assignment_id=id,
            status="running",
            details={"pending_count": count},
        )
