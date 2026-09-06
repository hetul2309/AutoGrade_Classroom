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
import io
import logging
import os
import shutil
import string
import secrets
import zipfile
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
    Request,
    UploadFile,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from sqlalchemy import and_, delete, desc, func, or_, select, String, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload


from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.auth import (
    create_access_token,
    get_current_user,
    hash_password,
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
    AdminClassItem,
    AdminGradeItem,
    AdminStatsResponse,
    AdminSubmissionItem,
    AdminUserItem,
    AssignmentCreateRequest,
    AssignmentResponse,
    ClassCreateRequest,
    ClassJoinRequest,
    ClassMemberResponse,
    ClassResponse,
    GoogleAuthRequest,
    GradePatchRequest,
    LoginRequest,
    RegisterRequest,
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

@app.post("/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED, tags=["Auth"])
@app.post("/auth/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED, tags=["Auth"])
async def register(
    payload: RegisterRequest,
    session: AsyncSession = Depends(get_db),
):
    """
    Registers a new user (teacher or student) into the AutoGrade platform.
    Requires First Name, Last Name, Email, Student ID, Password, Confirm Password.
    """
    if payload.password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match.",
        )

    if len(payload.password) < 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 4 characters long.",
        )

    email_clean = payload.email.strip().lower()
    first_name_clean = payload.first_name.strip()
    last_name_clean = payload.last_name.strip()
    student_id_clean = payload.student_id.strip()
    full_name = f"{first_name_clean} {last_name_clean}".strip() or "Student"

    # Check email uniqueness
    stmt = select(Student).where(func.lower(Student.email) == email_clean)
    existing_user = (await session.execute(stmt)).scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An account with email '{email_clean}' already exists. Please log in.",
        )

    # Check if student_id is numeric and can be used as primary key id if available
    user_id = None
    if student_id_clean.isdigit():
        numeric_id = int(student_id_clean)
        id_check = (await session.execute(select(Student.id).where(Student.id == numeric_id))).scalar_one_or_none()
        if not id_check:
            user_id = numeric_id

    hashed_pw = hash_password(payload.password)

    new_user = Student(
        name=full_name,
        first_name=first_name_clean,
        last_name=last_name_clean,
        student_id_str=student_id_clean,
        email=email_clean,
        hashed_password=hashed_pw,
        role=UserRole.student,
    )
    if user_id is not None:
        new_user.id = user_id

    session.add(new_user)
    await session.commit()
    await session.refresh(new_user)

    logger.info("New user registered: %s (%s, ID: %d)", new_user.name, new_user.email, new_user.id)

    access_token = create_access_token(
        data={"sub": str(new_user.id), "email": new_user.email, "role": new_user.role.value}
    )

    return TokenResponse(
        access_token=access_token,
        role=new_user.role.value,
        user_id=new_user.id,
        name=new_user.name,
        email=new_user.email,
    )


@app.post("/auth/login", response_model=TokenResponse, tags=["Auth"])
async def login(
    payload: LoginRequest,
    session: AsyncSession = Depends(get_db),
):
    """
    Authenticates a student or admin user with email and password.
    Returns a JWT access token containing the user's role and ID.
    """
    stmt = select(Student).where(func.lower(Student.email) == payload.email.strip().lower())
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


@app.post("/auth/google", response_model=TokenResponse, tags=["Auth"])
async def google_auth(
    payload: GoogleAuthRequest,
    session: AsyncSession = Depends(get_db),
):
    """
    Authenticates a user via Google Sign-In ID token.
    If the user does not exist in the database, automatically registers them as a student.
    """
    token_str = payload.credential.strip()
    if not token_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Google credential token",
        )

    try:
        client_id = settings.GOOGLE_CLIENT_ID or os.getenv("GOOGLE_CLIENT_ID") or None
        id_info = id_token.verify_oauth2_token(
            token_str,
            google_requests.Request(),
            audience=client_id if client_id else None,
        )
    except Exception as e:
        logger.warning("Google token verification failed: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token: {str(e)}",
        )

    email = id_info.get("email", "").strip().lower()
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account did not provide a verified email",
        )

    name = id_info.get("name", "").strip() or email.split("@")[0]
    first_name = id_info.get("given_name", "").strip() or name
    last_name = id_info.get("family_name", "").strip() or ""

    # Check if user already exists
    stmt = select(Student).where(func.lower(Student.email) == email)
    user = (await session.execute(stmt)).scalar_one_or_none()

    if not user:
        random_pw = secrets.token_urlsafe(16)
        user = Student(
            name=name,
            first_name=first_name,
            last_name=last_name,
            student_id_str=email.split("@")[0],
            email=email,
            hashed_password=hash_password(random_pw),
            role=UserRole.student,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        logger.info("New user registered via Google: %s (%s, ID: %d)", user.name, user.email, user.id)

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
        plagiarism_policy=a.plagiarism_policy,
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
                is_teacher=(c.teacher_id == current_user.id),
                created_at=c.created_at,
            )
        )

    return class_responses


@app.post("/classes", response_model=ClassResponse, status_code=status.HTTP_201_CREATED, tags=["Classes"])
async def create_class(
    payload: ClassCreateRequest,
    session: AsyncSession = Depends(get_db),
    current_user: Student = Depends(get_current_user),
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
        teacher_id=current_user.id,
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
        teacher_name=current_user.name,
        student_count=0,
        assignment_count=0,
        is_teacher=True,
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


def format_assignment_response(a: Assignment, is_admin: bool = True) -> AssignmentResponse:
    has_att = bool(a.attachment_path and os.path.exists(a.attachment_path))
    return AssignmentResponse(
        id=a.id,
        class_id=a.class_id,
        title=a.title,
        description=a.description,
        llm_prompt=a.llm_prompt if is_admin else None,
        rubric_text=a.rubric_text if is_admin else "",
        plagiarism_policy=a.plagiarism_policy if is_admin else None,
        max_marks=a.max_marks,
        deadline=a.deadline,
        results_published=a.results_published,
        attachment_name=a.attachment_name,
        has_attachment=has_att,
        created_at=a.created_at,
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
    is_admin = current_user.role == UserRole.admin
    return [format_assignment_response(a, is_admin=is_admin) for a in res.scalars().all()]


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
    llm_prompt: Optional[str] = Form(None),
    rubric_text: Optional[str] = Form(""),
    plagiarism_policy: Optional[str] = Form(None),
    max_marks: float = Form(100.0),
    deadline: str = Form(...),
    attachment: Optional[UploadFile] = File(None),
    session: AsyncSession = Depends(get_db),
    admin_user: Student = Depends(require_admin),
):
    """
    Teacher creates an assignment inside a class.
    Only asks for student-facing description and basics.
    LLM prompt and rubrics can be defined in the Notebook Evaluation & Grading section.
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
        llm_prompt=llm_prompt or description,
        rubric_text=rubric_text or "",
        plagiarism_policy=plagiarism_policy,
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
    return format_assignment_response(assignment, is_admin=True)


@app.patch("/assignments/{id}", response_model=AssignmentResponse, tags=["Assignments"])
@app.put("/assignments/{id}", response_model=AssignmentResponse, tags=["Assignments"])
async def update_assignment(
    id: int,
    request: Request,
    session: AsyncSession = Depends(get_db),
    admin_user: Student = Depends(require_admin),
):
    """
    Teacher updates an assignment:
    - Extend or change the deadline
    - Update instructions given to students (description)
    - Update private prompt given specifically to LLM (llm_prompt)
    - Update prompt / criteria given to LLM (rubric_text)
    - Update plagiarism & cheating policy (plagiarism_policy)
    - Update max marks
    - Optionally upload a new / replacement PDF handout
    Supports both JSON payloads and multipart/form-data.
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

    content_type = request.headers.get("content-type", "").lower()

    if "multipart/form-data" in content_type:
        form = await request.form()
        title = form.get("title")
        description = form.get("description")
        llm_prompt = form.get("llm_prompt")
        rubric_text = form.get("rubric_text")
        plagiarism_policy = form.get("plagiarism_policy")
        max_marks = form.get("max_marks")
        deadline = form.get("deadline")
        attachment = form.get("attachment")

        if title is not None and str(title).strip():
            assignment.title = str(title).strip()
        if description is not None:
            assignment.description = str(description).strip()
        if llm_prompt is not None:
            assignment.llm_prompt = str(llm_prompt).strip()
        if rubric_text is not None:
            assignment.rubric_text = str(rubric_text).strip()
        if plagiarism_policy is not None:
            assignment.plagiarism_policy = str(plagiarism_policy).strip()
        if max_marks is not None and str(max_marks).strip():
            try:
                assignment.max_marks = float(max_marks)
            except ValueError:
                pass
        if deadline is not None and str(deadline).strip():
            try:
                assignment.deadline = datetime.fromisoformat(str(deadline).replace("Z", "+00:00"))
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid deadline format. Please provide a valid ISO 8601 string.",
                )
        if attachment and hasattr(attachment, "filename") and attachment.filename:
            handout_dir = Path("uploads/handouts") / f"assignment_{assignment.id}"
            handout_dir.mkdir(parents=True, exist_ok=True)
            safe_name = os.path.basename(attachment.filename)
            dest_path = handout_dir / safe_name
            with open(dest_path, "wb") as f:
                shutil.copyfileobj(attachment.file, f)
            assignment.attachment_path = str(dest_path)
            assignment.attachment_name = safe_name
    else:
        # JSON Payload
        try:
            body = await request.json()
        except Exception:
            body = {}

        if "title" in body and body["title"] and str(body["title"]).strip():
            assignment.title = str(body["title"]).strip()
        if "description" in body and body["description"] is not None:
            assignment.description = str(body["description"]).strip()
        if "llm_prompt" in body and body["llm_prompt"] is not None:
            assignment.llm_prompt = str(body["llm_prompt"]).strip()
        if "rubric_text" in body and body["rubric_text"] is not None:
            assignment.rubric_text = str(body["rubric_text"]).strip()
        if "plagiarism_policy" in body and body["plagiarism_policy"] is not None:
            assignment.plagiarism_policy = str(body["plagiarism_policy"]).strip()
        if "max_marks" in body and body["max_marks"] is not None:
            try:
                assignment.max_marks = float(body["max_marks"])
            except ValueError:
                pass
        if "deadline" in body and body["deadline"]:
            try:
                assignment.deadline = datetime.fromisoformat(str(body["deadline"]).replace("Z", "+00:00"))
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid deadline format. Please provide a valid ISO 8601 string.",
                )

    await session.commit()
    await session.refresh(assignment)
    logger.info(
        "Admin %s updated assignment id=%d (%s): desc_len=%d, llm_prompt_len=%d, rubric_len=%d, plag_len=%d",
        admin_user.name, assignment.id, assignment.title,
        len(assignment.description or ""), len(assignment.llm_prompt or ""),
        len(assignment.rubric_text or ""), len(assignment.plagiarism_policy or "")
    )
    return format_assignment_response(assignment, is_admin=True)


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
    sub_stmt = (
        select(Submission)
        .where(
            Submission.assignment_id == assignment_id,
            Submission.student_id == current_user.id,
        )
        .options(selectinload(Submission.grade))
    )
    existing_sub = (await session.execute(sub_stmt)).scalar_one_or_none()

    # 4. Save file to storage
    upload_dir = Path(settings.UPLOAD_DIR) / f"assignment_{assignment_id}"
    upload_dir.mkdir(parents=True, exist_ok=True)
    clean_filename = Path(file.filename).name
    saved_path = upload_dir / f"student_{current_user.id}_{clean_filename}"

    with open(saved_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 5. Persist submission record (allow replacing/resubmitting notebook before deadline)
    if existing_sub:
        if existing_sub.grade:
            await session.delete(existing_sub.grade)
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
    logger.info(
        "Student %s (id=%d) submitted/replaced notebook '%s' for assignment id=%d",
        current_user.name, current_user.id, clean_filename, assignment_id
    )
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
    submitted_ass_ids = set()

    for sub in submissions:
        submitted_ass_ids.add(sub.assignment_id)
        grade = sub.grade
        fname = Path(sub.file_path).name if sub.file_path else None
        # Remove internal prefix if formatted like 'assignment_74_202401002_...'
        if fname and fname.startswith(f"assignment_{sub.assignment_id}_{sub.student_id}_"):
            fname = fname[len(f"assignment_{sub.assignment_id}_{sub.student_id}_"):]
        elif fname and fname.startswith(f"student_{sub.student_id}_"):
            fname = fname[len(f"student_{sub.student_id}_"):]

        is_published = bool(sub.assignment and sub.assignment.results_published)
        views.append(
            StudentGradeView(
                submission_id=sub.id,
                assignment_id=sub.assignment_id,
                assignment_title=sub.assignment.title if sub.assignment else "Unknown Assignment",
                file_name=fname,
                status=sub.status.value if is_published else "pending",
                marks=grade.marks if (grade and is_published) else None,
                max_marks=grade.max_marks if (grade and is_published) else None,
                reasoning_text=grade.reasoning_text if (grade and is_published) else None,
                submitted_at=sub.submitted_at,
                graded_at=grade.graded_at if (grade and is_published) else None,
            )
        )

    # Find assignments in classes the student is enrolled in where they did NOT submit
    class_ass_stmt = (
        select(Assignment)
        .join(ClassEnrollment, ClassEnrollment.class_id == Assignment.class_id)
        .where(ClassEnrollment.student_id == current_user.id)
    )
    all_class_assignments = (await session.execute(class_ass_stmt)).scalars().all()

    for ass in all_class_assignments:
        if ass.id not in submitted_ass_ids:
            is_published = bool(ass.results_published)
            views.append(
                StudentGradeView(
                    submission_id=None,
                    assignment_id=ass.id,
                    assignment_title=ass.title,
                    file_name=None,
                    status="no_submission",
                    marks=0.0 if is_published else None,
                    max_marks=ass.max_marks if is_published else None,
                    reasoning_text="No file uploaded (Not submitted)." if is_published else None,
                    submitted_at=None,
                    graded_at=None,
                )
            )

    return views


# ── Admin Endpoints ───────────────────────────────────────────────────────────

@app.post("/admin/assignments/{id}/publish-results", response_model=AssignmentResponse, tags=["Admin"])
async def publish_assignment_results(
    id: int,
    session: AsyncSession = Depends(get_db),
    admin_user: Student = Depends(require_admin),
):
    """
    Teacher publishes evaluated grades and AI feedback to students for an assignment.
    """
    assignment = await session.get(Assignment, id)
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    if assignment.class_id:
        target_class = await session.get(Class, assignment.class_id)
        if target_class and target_class.teacher_id != admin_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    assignment.results_published = True
    await session.commit()
    await session.refresh(assignment)
    logger.info("Admin %s published results for assignment id=%d ('%s')", admin_user.name, assignment.id, assignment.title)
    return format_assignment_response(assignment, is_admin=True)


@app.post("/admin/assignments/{id}/unpublish-results", response_model=AssignmentResponse, tags=["Admin"])
async def unpublish_assignment_results(
    id: int,
    session: AsyncSession = Depends(get_db),
    admin_user: Student = Depends(require_admin),
):
    """
    Teacher unpublishes grades and AI feedback to students for an assignment.
    """
    assignment = await session.get(Assignment, id)
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    if assignment.class_id:
        target_class = await session.get(Class, assignment.class_id)
        if target_class and target_class.teacher_id != admin_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    assignment.results_published = False
    await session.commit()
    await session.refresh(assignment)
    logger.info("Admin %s unpublished results for assignment id=%d ('%s')", admin_user.name, assignment.id, assignment.title)
    return format_assignment_response(assignment, is_admin=True)

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
    Includes all enrolled students in the class (assigning 0 for unsubmitted).
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
    sub_map = {sub.student_id: sub for sub in submissions}

    items: List[AdminGradeItem] = []
    processed_student_ids = set()

    # If assignment belongs to a class, fetch all enrolled students
    if assignment.class_id:
        enr_stmt = (
            select(Student)
            .join(ClassEnrollment, ClassEnrollment.student_id == Student.id)
            .where(ClassEnrollment.class_id == assignment.class_id)
            .order_by(Student.id.asc())
        )
        enrolled_students = (await session.execute(enr_stmt)).scalars().all()

        for student in enrolled_students:
            processed_student_ids.add(student.id)
            if student.id in sub_map:
                sub = sub_map[student.id]
                grade = sub.grade
                items.append(
                    AdminGradeItem(
                        grade_id=grade.id if grade else None,
                        submission_id=sub.id,
                        student_id=sub.student_id,
                        student_name=sub.student.name if sub.student else student.name,
                        student_email=sub.student.email if sub.student else student.email,
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
            else:
                # Student enrolled in class but has NOT submitted a notebook file
                items.append(
                    AdminGradeItem(
                        grade_id=None,
                        submission_id=None,
                        student_id=student.id,
                        student_name=student.name,
                        student_email=student.email,
                        assignment_id=assignment.id,
                        marks=0.0,
                        max_marks=assignment.max_marks,
                        reasoning_text="No file uploaded (Not submitted).",
                        flagged=False,
                        flag_reason=None,
                        submission_status="no_submission",
                        submitted_at=None,
                        graded_at=None,
                        manually_edited=False,
                        edited_by_admin_id=None,
                        edited_at=None,
                    )
                )

    # Any other submissions from students not currently enrolled
    for sub in submissions:
        if sub.student_id not in processed_student_ids:
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


@app.get("/admin/submissions/{id}/download", tags=["Admin"])
async def download_single_submission(
    id: int,
    session: AsyncSession = Depends(get_db),
    admin_user: Student = Depends(require_admin),
):
    """
    Teacher downloads an individual student's uploaded .ipynb notebook file.
    """
    submission = await session.get(Submission, id)
    if not submission or not submission.file_path or not os.path.exists(submission.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notebook submission file not found on disk."
        )

    file_p = Path(submission.file_path)
    clean_name = file_p.name
    # Clean up name if it has internal prefixes
    if clean_name.startswith(f"assignment_{submission.assignment_id}_{submission.student_id}_"):
        clean_name = clean_name[len(f"assignment_{submission.assignment_id}_{submission.student_id}_"):]
    elif clean_name.startswith(f"student_{submission.student_id}_"):
        clean_name = clean_name[len(f"student_{submission.student_id}_"):]

    download_filename = f"{submission.student_id}_{clean_name}"
    if not download_filename.endswith(".ipynb"):
        download_filename += ".ipynb"

    return FileResponse(
        path=str(file_p.resolve()),
        filename=download_filename,
        media_type="application/x-ipynb+json",
    )


@app.get("/admin/assignments/{id}/download-all", tags=["Admin"])
async def download_all_submissions_zip(
    id: int,
    session: AsyncSession = Depends(get_db),
    admin_user: Student = Depends(require_admin),
):
    """
    Teacher downloads a ZIP archive containing all uploaded student .ipynb files for this assignment.
    """
    assignment = await session.get(Assignment, id)
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    stmt = (
        select(Submission)
        .where(Submission.assignment_id == id)
        .options(selectinload(Submission.student))
        .order_by(Submission.student_id.asc())
    )
    submissions = (await session.execute(stmt)).scalars().all()

    valid_subs = [s for s in submissions if s.file_path and os.path.exists(s.file_path)]
    if not valid_subs:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No uploaded student notebook submissions found for this assignment."
        )

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for sub in valid_subs:
            file_p = Path(sub.file_path)
            clean_name = file_p.name
            if clean_name.startswith(f"assignment_{sub.assignment_id}_{sub.student_id}_"):
                clean_name = clean_name[len(f"assignment_{sub.assignment_id}_{sub.student_id}_"):]
            elif clean_name.startswith(f"student_{sub.student_id}_"):
                clean_name = clean_name[len(f"student_{sub.student_id}_"):]

            in_zip_filename = f"{sub.student_id}_{clean_name}"
            if not in_zip_filename.endswith(".ipynb"):
                in_zip_filename += ".ipynb"

            zip_file.write(str(file_p.resolve()), arcname=in_zip_filename)

    zip_buffer.seek(0)
    safe_title = "".join(c for c in assignment.title if c.isalnum() or c in ("-", "_")).strip() or f"assignment_{id}"
    zip_name = f"{safe_title}_submissions.zip"

    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{zip_name}"'
        }
    )


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

    # 2. Grade with LLM strictly using latest Academic Marking Rubric & LLM Task Prompt (ignoring cheating criteria on individual recheck)
    res = await asyncio.to_thread(
        grade_submission,
        rubric=assignment.rubric_text,
        task_description=assignment.llm_prompt or assignment.description,
        notebook_text=nb_result.text,
        similarity_flag=None,
        max_marks=assignment.max_marks,
    )

    # 4. Save to DB
    grade_stmt = select(Grade).where(Grade.submission_id == sub.id)
    grade_obj = (await session.execute(grade_stmt)).scalar_one_or_none()

    if grade_obj:
        grade_obj.marks = res.marks
        grade_obj.max_marks = res.max_marks
        grade_obj.reasoning_text = res.reasoning
        grade_obj.flagged = False
        grade_obj.flag_reason = None
        grade_obj.graded_at = datetime.now(timezone.utc)
        grade_obj.manually_edited = False
    else:
        grade_obj = Grade(
            submission_id=sub.id,
            marks=res.marks,
            max_marks=res.max_marks,
            reasoning_text=res.reasoning,
            flagged=False,
            flag_reason=None,
            graded_at=datetime.now(timezone.utc),
        )
        session.add(grade_obj)

    sub.status = SubmissionStatus.graded
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
            processed_count=count,
            flagged_count=0,
        )


# ── System Admin Portal Endpoints ─────────────────────────────────────────────

@app.get("/admin/stats", response_model=AdminStatsResponse, tags=["Admin Portal"])
async def get_admin_stats(
    session: AsyncSession = Depends(get_db),
    admin_user: Student = Depends(require_admin),
):
    """Returns platform-wide statistics for the admin dashboard."""
    total_users = (await session.execute(select(func.count(Student.id)))).scalar() or 0
    total_students = (await session.execute(select(func.count(Student.id)).where(Student.role == UserRole.student))).scalar() or 0
    total_classes = (await session.execute(select(func.count(Class.id)))).scalar() or 0
    total_assignments = (await session.execute(select(func.count(Assignment.id)))).scalar() or 0
    total_submissions = (await session.execute(select(func.count(Submission.id)))).scalar() or 0
    total_graded = (await session.execute(select(func.count(Grade.id)))).scalar() or 0

    # Distinct instructors count
    distinct_teachers = (await session.execute(select(func.count(func.distinct(Class.teacher_id))))).scalar() or 0

    return AdminStatsResponse(
        total_users=total_users,
        total_students=total_students,
        total_instructors=distinct_teachers,
        total_classes=total_classes,
        total_assignments=total_assignments,
        total_submissions=total_submissions,
        total_graded=total_graded,
    )


@app.get("/admin/users", response_model=List[AdminUserItem], tags=["Admin Portal"])
async def get_admin_users(
    search: Optional[str] = None,
    role: Optional[str] = None,
    session: AsyncSession = Depends(get_db),
    admin_user: Student = Depends(require_admin),
):
    """
    Returns all registered users in the database with their metadata and statistics.
    Supports filtering by search query and role.
    """
    stmt = select(Student)

    if role and role != "all":
        stmt = stmt.where(Student.role == role)

    if search and search.strip():
        q = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Student.name).like(q),
                func.lower(Student.email).like(q),
                func.lower(Student.student_id_str).like(q),
                func.cast(Student.id, String).like(q),
            )
        )

    stmt = stmt.order_by(Student.created_at.desc())
    res = await session.execute(stmt)
    users = res.scalars().all()

    user_items = []
    for u in users:
        # Count enrolled classes
        enrolled_res = await session.execute(
            select(func.count(ClassEnrollment.id)).where(ClassEnrollment.student_id == u.id)
        )
        enrolled_count = enrolled_res.scalar() or 0

        # Count teaching classes
        teaching_res = await session.execute(
            select(func.count(Class.id)).where(Class.teacher_id == u.id)
        )
        teaching_count = teaching_res.scalar() or 0

        # Count submissions
        subs_res = await session.execute(
            select(func.count(Submission.id)).where(Submission.student_id == u.id)
        )
        subs_count = subs_res.scalar() or 0

        user_items.append(
            AdminUserItem(
                id=u.id,
                name=u.name,
                first_name=u.first_name,
                last_name=u.last_name,
                email=u.email,
                student_id_str=u.student_id_str,
                role=u.role.value,
                created_at=u.created_at,
                enrolled_classes_count=enrolled_count,
                teaching_classes_count=teaching_count,
                submissions_count=subs_count,
            )
        )

    return user_items


@app.delete("/admin/users/{user_id}", tags=["Admin Portal"])
async def delete_user(
    user_id: int,
    session: AsyncSession = Depends(get_db),
    admin_user: Student = Depends(require_admin),
):
    """Deletes a user from the system. (Admin cannot delete themselves)."""
    if user_id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own admin account.",
        )

    target_user = await session.get(Student, user_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Delete related enrollments, submissions, grades
    await session.execute(delete(ClassEnrollment).where(ClassEnrollment.student_id == user_id))
    await session.execute(delete(Grade).where(Grade.student_id == user_id))
    await session.execute(delete(Submission).where(Submission.student_id == user_id))
    await session.delete(target_user)
    await session.commit()

    logger.info("Admin %s deleted user ID %d (%s)", admin_user.email, user_id, target_user.email)
    return {"message": f"User {target_user.name} ({target_user.email}) deleted successfully."}


@app.get("/admin/classes", response_model=List[AdminClassItem], tags=["Admin Portal"])
async def get_admin_classes(
    session: AsyncSession = Depends(get_db),
    admin_user: Student = Depends(require_admin),
):
    """Returns all classes across the system with teacher and student counts."""
    classes = (await session.execute(select(Class).order_by(Class.created_at.desc()))).scalars().all()

    class_items = []
    for c in classes:
        teacher = await session.get(Student, c.teacher_id)
        teacher_name = teacher.name if teacher else "Unknown Faculty"
        teacher_email = teacher.email if teacher else "N/A"

        student_count = (await session.execute(
            select(func.count(ClassEnrollment.id)).where(ClassEnrollment.class_id == c.id)
        )).scalar() or 0

        assignment_count = (await session.execute(
            select(func.count(Assignment.id)).where(Assignment.class_id == c.id)
        )).scalar() or 0

        class_items.append(
            AdminClassItem(
                id=c.id,
                name=c.name,
                section=c.section,
                code=c.code,
                color=c.color,
                teacher_id=c.teacher_id,
                teacher_name=teacher_name,
                teacher_email=teacher_email,
                student_count=student_count,
                assignment_count=assignment_count,
                created_at=c.created_at,
            )
        )

    return class_items


@app.get("/admin/submissions", response_model=List[AdminSubmissionItem], tags=["Admin Portal"])
async def get_admin_submissions(
    session: AsyncSession = Depends(get_db),
    admin_user: Student = Depends(require_admin),
):
    """Returns all student submissions across all courses with grade info."""
    stmt = (
        select(Submission)
        .order_by(Submission.submitted_at.desc())
        .limit(100)
    )
    submissions = (await session.execute(stmt)).scalars().all()

    sub_items = []
    for s in submissions:
        student = await session.get(Student, s.student_id)
        assignment = await session.get(Assignment, s.assignment_id)
        cls = await session.get(Class, assignment.class_id) if assignment else None
        grade = (await session.execute(
            select(Grade).where(Grade.submission_id == s.id)
        )).scalar_one_or_none()

        sub_items.append(
            AdminSubmissionItem(
                id=s.id,
                assignment_id=s.assignment_id,
                assignment_title=assignment.title if assignment else "Unknown Assignment",
                class_id=cls.id if cls else 0,
                class_name=cls.name if cls else "Unknown Class",
                student_id=s.student_id,
                student_name=student.name if student else "Unknown Student",
                student_email=student.email if student else "N/A",
                file_name=s.original_filename or os.path.basename(s.file_path),
                status=s.status.value,
                marks=grade.marks if grade else None,
                max_marks=assignment.max_marks if assignment else None,
                flagged=grade.flagged if grade else False,
                submitted_at=s.submitted_at,
                graded_at=grade.graded_at if grade else None,
            )
        )

    return sub_items

