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

import asyncio
import logging
import os
import shutil
import string
import secrets
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
from fastapi.responses import FileResponse
from sqlalchemy import and_, desc, func, or_, select, update
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
    Class,
    ClassEnrollment,
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
    ClassCreateRequest,
    ClassJoinRequest,
    ClassMemberResponse,
    ClassResponse,
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


# ── Assignment Helper ─────────────────────────────────────────────────────────

def format_assignment_response(a: Assignment) -> AssignmentResponse:
    has_att = bool(a.attachment_path and os.path.exists(a.attachment_path))
    return AssignmentResponse(
        id=a.id,
        class_id=a.class_id,
        title=a.title,
        description=a.description,
        rubric_text=a.rubric_text,
        max_marks=a.max_marks,
        deadline=a.deadline,
        attachment_name=a.attachment_name,
        has_attachment=has_att,
        created_at=a.created_at,
    )


# ── Classes Endpoints (Google Classroom Clone) ────────────────────────────────

@app.get("/classes", response_model=List[ClassResponse], tags=["Classes"])
async def list_classes(
    session: AsyncSession = Depends(get_db),
    current_user: Student = Depends(get_current_user),
):
    """
    Lists classes for the authenticated user.
    Strict isolation rule:
    A user (teacher or student) can ONLY see classes that they created OR are enrolled in.
    If someone is neither the creator/teacher nor enrolled as a student,
    the class is completely hidden from their dashboard.
    """
    enrolled_class_ids_subquery = (
        select(ClassEnrollment.class_id)
        .where(ClassEnrollment.student_id == current_user.id)
        .scalar_subquery()
    )

    stmt = (
        select(Class)
        .where(
            or_(
                Class.teacher_id == current_user.id,
                Class.id.in_(enrolled_class_ids_subquery),
            )
        )
        .order_by(Class.created_at.desc())
    )

    res = await session.execute(stmt)
    classes = res.scalars().all()

    class_responses = []
    for c in classes:
        teacher = await session.get(Student, c.teacher_id)
        teacher_name = teacher.name if teacher else "Faculty"

        s_count_res = await session.execute(
            select(func.count(ClassEnrollment.id)).where(ClassEnrollment.class_id == c.id)
        )
        student_count = s_count_res.scalar() or 0

        a_count_res = await session.execute(
            select(func.count(Assignment.id)).where(Assignment.class_id == c.id)
        )
        assignment_count = a_count_res.scalar() or 0

        class_responses.append(
            ClassResponse(
                id=c.id,
                name=c.name,
                section=c.section,
                code=c.code,
                color=c.color,
                teacher_id=c.teacher_id,
                teacher_name=teacher_name,
                student_count=student_count,
                assignment_count=assignment_count,
                created_at=c.created_at,
            )
        )

    return class_responses


@app.post("/classes", response_model=ClassResponse, status_code=status.HTTP_201_CREATED, tags=["Classes"])
async def create_class(
    payload: ClassCreateRequest,
    session: AsyncSession = Depends(get_db),
    admin_user: Student = Depends(require_admin),
):
    """Creates a new class with an auto-generated unique 6-character code."""
    charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    for _ in range(10):
        candidate_code = "".join(secrets.choice(charset) for _ in range(6))
        exists_res = await session.execute(select(Class.id).where(Class.code == candidate_code))
        if not exists_res.scalar_one_or_none():
            break
    else:
        candidate_code = secrets.token_hex(3).upper()

    new_class = Class(
        name=payload.name,
        section=payload.section,
        code=candidate_code,
        color=payload.color,
        teacher_id=admin_user.id,
    )
    session.add(new_class)
    await session.commit()
    await session.refresh(new_class)

    return ClassResponse(
        id=new_class.id,
        name=new_class.name,
        section=new_class.section,
        code=new_class.code,
        color=new_class.color,
        teacher_id=new_class.teacher_id,
        teacher_name=admin_user.name,
        student_count=0,
        assignment_count=0,
        created_at=new_class.created_at,
    )


@app.post("/classes/join", response_model=ClassResponse, tags=["Classes"])
async def join_class(
    payload: ClassJoinRequest,
    session: AsyncSession = Depends(get_db),
    current_user: Student = Depends(get_current_user),
):
    """Student joins a class using a 6-character class code."""
    cleaned_code = payload.code.strip().upper()
    res = await session.execute(select(Class).where(Class.code == cleaned_code))
    target_class = res.scalar_one_or_none()

    if not target_class:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No class found with code '{cleaned_code}'. Please verify the code with your instructor.",
        )

    # Check if already enrolled
    enrolled_res = await session.execute(
        select(ClassEnrollment).where(
            and_(
                ClassEnrollment.class_id == target_class.id,
                ClassEnrollment.student_id == current_user.id,
            )
        )
    )
    if not enrolled_res.scalar_one_or_none():
        enrollment = ClassEnrollment(class_id=target_class.id, student_id=current_user.id)
        session.add(enrollment)
        await session.commit()

    teacher = await session.get(Student, target_class.teacher_id)
    teacher_name = teacher.name if teacher else "Faculty"

    s_count_res = await session.execute(
        select(func.count(ClassEnrollment.id)).where(ClassEnrollment.class_id == target_class.id)
    )
    student_count = s_count_res.scalar() or 0

    a_count_res = await session.execute(
        select(func.count(Assignment.id)).where(Assignment.class_id == target_class.id)
    )
    assignment_count = a_count_res.scalar() or 0

    return ClassResponse(
        id=target_class.id,
        name=target_class.name,
        section=target_class.section,
        code=target_class.code,
        color=target_class.color,
        teacher_id=target_class.teacher_id,
        teacher_name=teacher_name,
        student_count=student_count,
        assignment_count=assignment_count,
        created_at=target_class.created_at,
    )


async def get_accessible_class(class_id: int, user: Student, session: AsyncSession) -> Class:
    """
    Verifies that the user is either the teacher who created the class
    or an enrolled student. Rejects unauthorized access with 403 Forbidden.
    """
    target_class = await session.get(Class, class_id)
    if not target_class:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")

    if target_class.teacher_id == user.id:
        return target_class

    enrolled = await session.execute(
        select(ClassEnrollment).where(
            and_(
                ClassEnrollment.class_id == class_id,
                ClassEnrollment.student_id == user.id,
            )
        )
    )
    if not enrolled.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You are neither the instructor nor an enrolled student in this class.",
        )
    return target_class


@app.get("/classes/{id}", response_model=ClassResponse, tags=["Classes"])
async def get_class(
    id: int,
    session: AsyncSession = Depends(get_db),
    current_user: Student = Depends(get_current_user),
):
    target_class = await get_accessible_class(id, current_user, session)

    teacher = await session.get(Student, target_class.teacher_id)
    teacher_name = teacher.name if teacher else "Faculty"

    s_count = (
        await session.execute(
            select(func.count(ClassEnrollment.id)).where(ClassEnrollment.class_id == id)
        )
    ).scalar() or 0

    a_count = (
        await session.execute(
            select(func.count(Assignment.id)).where(Assignment.class_id == id)
        )
    ).scalar() or 0

    return ClassResponse(
        id=target_class.id,
        name=target_class.name,
        section=target_class.section,
        code=target_class.code,
        color=target_class.color,
        teacher_id=target_class.teacher_id,
        teacher_name=teacher_name,
        student_count=s_count,
        assignment_count=a_count,
        created_at=target_class.created_at,
    )


@app.get("/classes/{id}/assignments", response_model=List[AssignmentResponse], tags=["Classes"])
async def list_class_assignments(
    id: int,
    session: AsyncSession = Depends(get_db),
    current_user: Student = Depends(get_current_user),
):
    """Lists all assignments belonging to a specific class for authorized members."""
    await get_accessible_class(id, current_user, session)

    stmt = (
        select(Assignment)
        .where(Assignment.class_id == id)
        .order_by(Assignment.deadline.asc())
    )
    res = await session.execute(stmt)
    return [format_assignment_response(a) for a in res.scalars().all()]


@app.post(
    "/classes/{id}/assignments",
    response_model=AssignmentResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Classes"],
)
async def create_class_assignment(
    id: int,
    title: str = Form(...),
    description: str = Form(...),
    rubric_text: str = Form(...),
    max_marks: float = Form(100.0),
    deadline: str = Form(...),
    attachment: Optional[UploadFile] = File(None),
    session: AsyncSession = Depends(get_db),
    admin_user: Student = Depends(require_admin),
):
    """
    Teacher creates an assignment inside a class.
    Only the teacher who created this class can publish assignments for it.
    """
    target_class = await session.get(Class, id)
    if not target_class:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
    if target_class.teacher_id != admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the teacher who created this class can publish assignments for it.",
        )
    try:
        deadline_dt = datetime.fromisoformat(deadline.replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid deadline format. Please provide a valid ISO 8601 string.",
        )

    assignment = Assignment(
        class_id=id,
        title=title,
        description=description,
        rubric_text=rubric_text,
        max_marks=max_marks,
        deadline=deadline_dt,
    )
    session.add(assignment)
    await session.commit()
    await session.refresh(assignment)

    if attachment and attachment.filename:
        handout_dir = Path("uploads/handouts") / f"assignment_{assignment.id}"
        handout_dir.mkdir(parents=True, exist_ok=True)
        safe_name = os.path.basename(attachment.filename)
        dest_path = handout_dir / safe_name
        with open(dest_path, "wb") as f:
            shutil.copyfileobj(attachment.file, f)
        assignment.attachment_path = str(dest_path)
        assignment.attachment_name = safe_name
        await session.commit()
        await session.refresh(assignment)

    logger.info(
        "Admin %s created assignment id=%d in class id=%d (attachment=%s)",
        admin_user.name, assignment.id, id, bool(assignment.attachment_path)
    )
    return format_assignment_response(assignment)


@app.patch("/assignments/{id}", response_model=AssignmentResponse, tags=["Assignments"])
@app.put("/assignments/{id}", response_model=AssignmentResponse, tags=["Assignments"])
async def update_assignment(
    id: int,
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    rubric_text: Optional[str] = Form(None),
    max_marks: Optional[float] = Form(None),
    deadline: Optional[str] = Form(None),
    attachment: Optional[UploadFile] = File(None),
    session: AsyncSession = Depends(get_db),
    admin_user: Student = Depends(require_admin),
):
    """
    Teacher updates an assignment:
    - Extend or change the deadline
    - Update instructions given to students (description)
    - Update prompt / criteria given to LLM (rubric_text)
    - Update max marks
    - Optionally upload a new / replacement PDF handout
    """
    assignment = await session.get(Assignment, id)
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    if assignment.class_id:
        target_class = await session.get(Class, assignment.class_id)
        if target_class and target_class.teacher_id != admin_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the teacher who created this class can edit its assignments.",
            )

    if title is not None and title.strip():
        assignment.title = title.strip()

    if description is not None and description.strip():
        assignment.description = description.strip()

    if rubric_text is not None and rubric_text.strip():
        assignment.rubric_text = rubric_text.strip()

    if max_marks is not None and max_marks > 0:
        assignment.max_marks = max_marks

    if deadline is not None and deadline.strip():
        try:
            deadline_dt = datetime.fromisoformat(deadline.replace("Z", "+00:00"))
            assignment.deadline = deadline_dt
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid deadline format. Please provide a valid ISO 8601 string.",
            )

    if attachment and attachment.filename:
        handout_dir = Path("uploads/handouts") / f"assignment_{assignment.id}"
        handout_dir.mkdir(parents=True, exist_ok=True)
        safe_name = os.path.basename(attachment.filename)
        dest_path = handout_dir / safe_name
        with open(dest_path, "wb") as f:
            shutil.copyfileobj(attachment.file, f)
        assignment.attachment_path = str(dest_path)
        assignment.attachment_name = safe_name

    await session.commit()
    await session.refresh(assignment)

    logger.info("Admin %s updated assignment id=%d (%s)", admin_user.name, assignment.id, assignment.title)
    return format_assignment_response(assignment)


@app.get("/assignments/{id}/attachment", tags=["Assignments"])
async def download_assignment_attachment(
    id: int,
    session: AsyncSession = Depends(get_db),
    current_user: Student = Depends(get_current_user),
):
    """Downloads the TA's uploaded PDF or document handout for an assignment."""
    assignment = await session.get(Assignment, id)
    if not assignment or not assignment.attachment_path or not os.path.exists(assignment.attachment_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No handout attached for this assignment.")

    return FileResponse(
        path=assignment.attachment_path,
        filename=assignment.attachment_name or f"assignment_{id}_handout.pdf",
        media_type="application/octet-stream",
    )


@app.get("/classes/{id}/students", response_model=List[ClassMemberResponse], tags=["Classes"])
async def list_class_students(
    id: int,
    session: AsyncSession = Depends(get_db),
    current_user: Student = Depends(get_current_user),
):
    """Lists students enrolled in a class."""
    stmt = (
        select(Student, ClassEnrollment.enrolled_at)
        .join(ClassEnrollment, ClassEnrollment.student_id == Student.id)
        .where(ClassEnrollment.class_id == id)
        .order_by(Student.name.asc())
    )
    res = await session.execute(stmt)
    members = []
    for student_obj, enrolled_at in res.all():
        members.append(
            ClassMemberResponse(
                student_id=student_obj.id,
                name=student_obj.name,
                email=student_obj.email,
                role=student_obj.role.value,
                enrolled_at=enrolled_at,
            )
        )
    return members


# ── Assignments Endpoints ─────────────────────────────────────────────────────

@app.get("/assignments", response_model=List[AssignmentResponse], tags=["Assignments"])
async def list_assignments(
    session: AsyncSession = Depends(get_db),
    current_user: Student = Depends(get_current_user),
):
    """Lists all available assignments."""
    stmt = select(Assignment).order_by(Assignment.deadline.asc())
    res = await session.execute(stmt)
    return [format_assignment_response(a) for a in res.scalars().all()]


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
    return format_assignment_response(assignment)


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
        class_id=payload.class_id,
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
    return format_assignment_response(assignment)


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
    "/admin/submissions/{id}/recheck",
    response_model=AdminGradeItem,
    tags=["Admin"],
)
async def recheck_single_submission(
    id: int,
    session: AsyncSession = Depends(get_db),
    admin_user: Student = Depends(require_admin),
):
    """
    Rechecks a single student submission using the latest assignment instructions and grading rubric.
    """
    sub = await session.get(Submission, id)
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    assignment = await session.get(Assignment, sub.assignment_id)
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    # Verify teacher access
    if assignment.class_id:
        target_class = await session.get(Class, assignment.class_id)
        if target_class and target_class.teacher_id != admin_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    # 1. Preprocess notebook
    from app.notebook_processing import process_notebook
    from app.grading import grade_submission
    from app.similarity import SubmissionText, find_similar_pairs

    path = Path(sub.file_path)
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Notebook file not found at {sub.file_path}")

    nb_result = process_notebook(path)

    # 2. Check pairwise similarity against all other submissions in this assignment
    other_subs_res = await session.execute(
        select(Submission)
        .where(Submission.assignment_id == sub.assignment_id, Submission.id != sub.id)
    )
    other_subs = other_subs_res.scalars().all()

    sub_texts = [
        SubmissionText(
            student_id=sub.student_id,
            submission_id=sub.id,
            code_cells=[(c.index, c.source) for c in nb_result.processed_cells if c.cell_type == "code"]
        )
    ]
    for os_sub in other_subs:
        os_path = Path(os_sub.file_path)
        if os_path.exists():
            try:
                os_nb = process_notebook(os_path)
                sub_texts.append(
                    SubmissionText(
                        student_id=os_sub.student_id,
                        submission_id=os_sub.id,
                        code_cells=[(c.index, c.source) for c in os_nb.processed_cells if c.cell_type == "code"]
                    )
                )
            except Exception:
                pass

    similarity_flag = None
    if len(sub_texts) >= 2:
        flags = find_similar_pairs(sub_texts, threshold=0.75)
        for f in flags:
            if f.submission_id_a == sub.id or f.submission_id_b == sub.id:
                partner_stu_id = f.student_id_b if f.submission_id_a == sub.id else f.student_id_a
                partner_student = await session.get(Student, partner_stu_id)
                partner_email = partner_student.email if partner_student else f"{partner_stu_id}@dau.ac.in"
                partner_name = partner_student.name if partner_student else "Student"

                f.explanation = (
                    f"Code match of {f.overall_score * 100:.1f}% detected with Student ID {partner_stu_id} "
                    f"({partner_name}, {partner_email}) across {len(f.matched_cells)} cell(s)."
                )
                similarity_flag = f
                break

    # 3. Grade with LLM using latest rubric and task description
    res = await asyncio.to_thread(
        grade_submission,
        rubric=assignment.rubric_text,
        task_description=assignment.description,
        notebook_text=nb_result.text,
        similarity_flag=similarity_flag,
        max_marks=assignment.max_marks,
    )

    # 4. Save to DB
    grade_stmt = select(Grade).where(Grade.submission_id == sub.id)
    grade_obj = (await session.execute(grade_stmt)).scalar_one_or_none()

    if grade_obj:
        grade_obj.marks = res.marks
        grade_obj.max_marks = res.max_marks
        grade_obj.reasoning_text = res.reasoning
        grade_obj.flagged = res.flagged
        grade_obj.flag_reason = res.flag_reason
        grade_obj.graded_at = datetime.now(timezone.utc)
        grade_obj.manually_edited = False
    else:
        grade_obj = Grade(
            submission_id=sub.id,
            marks=res.marks,
            max_marks=res.max_marks,
            reasoning_text=res.reasoning,
            flagged=res.flagged,
            flag_reason=res.flag_reason,
            graded_at=datetime.now(timezone.utc),
        )
        session.add(grade_obj)

    sub.status = SubmissionStatus.flagged if res.flagged else SubmissionStatus.graded
    await session.commit()
    await session.refresh(grade_obj)
    await session.refresh(sub)

    student = await session.get(Student, sub.student_id)
    return AdminGradeItem(
        grade_id=grade_obj.id,
        submission_id=sub.id,
        student_id=sub.student_id,
        student_name=student.name if student else "Unknown",
        student_email=student.email if student else "Unknown",
        assignment_id=sub.assignment_id,
        marks=grade_obj.marks,
        max_marks=grade_obj.max_marks,
        reasoning_text=grade_obj.reasoning_text,
        flagged=grade_obj.flagged,
        flag_reason=grade_obj.flag_reason,
        submission_status=sub.status.value,
        submitted_at=sub.submitted_at,
        graded_at=grade_obj.graded_at,
        manually_edited=grade_obj.manually_edited,
        edited_by_admin_id=grade_obj.edited_by_admin_id,
        edited_at=grade_obj.edited_at,
    )


@app.post(
    "/admin/assignments/{id}/trigger-grading",
    response_model=TriggerGradingResponse,
    tags=["Admin"],
)
async def trigger_grading_pipeline(
    id: int,
    direct: bool = False,
    recheck_all: bool = False,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    session: AsyncSession = Depends(get_db),
    admin_user: Student = Depends(require_admin),
):
    """
    Triggers Phase 5's LangGraph batch grading pipeline for an assignment.
    Processes all pending submissions through preprocessing, similarity checking,
    batch LLM evaluation, and database persistence.
    If recheck_all=True, resets all existing submissions to pending to re-evaluate them with latest prompt/rubric.
    """
    assignment = await session.get(Assignment, id)
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    if recheck_all:
        await session.execute(
            update(Submission)
            .where(Submission.assignment_id == id)
            .values(status=SubmissionStatus.pending)
        )
        await session.commit()

    # Count submissions ready to be graded (pending, processing, or errored)
    stmt = select(Submission).where(
        Submission.assignment_id == id,
        Submission.status.in_([SubmissionStatus.pending, SubmissionStatus.processing, SubmissionStatus.error]),
    )
    pending_subs = (await session.execute(stmt)).scalars().all()
    count = len(pending_subs)

    if count == 0:
        return TriggerGradingResponse(
            message="No submissions found to grade for this assignment.",
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
