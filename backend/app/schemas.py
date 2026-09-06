"""
schemas.py
----------
Pydantic data models and schemas for request validation and API responses.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr


# ── Auth & User Schemas ───────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleAuthRequest(BaseModel):
    credential: str


class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    student_id: str
    password: str
    confirm_password: str



class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    student_id_str: Optional[str] = None
    email: str
    avatar_url: Optional[str] = None
    profile_completed: bool = True


class UserResponse(BaseModel):
    id: int
    name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    student_id_str: Optional[str] = None
    email: str
    role: str
    avatar_url: Optional[str] = None
    profile_completed: bool = True
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str
    confirm_password: str


class UpdateProfileRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    student_id_str: Optional[str] = None
    avatar_url: Optional[str] = None


class SendOtpRequest(BaseModel):
    email: str
    purpose: str = "signup"  # "signup" or "forgot_password"


class VerifyOtpRequest(BaseModel):
    email: str
    otp: str
    purpose: str = "signup"


class ResetPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str
    confirm_password: str


# ── Class Schemas ─────────────────────────────────────────────────────────────

class ClassCreateRequest(BaseModel):
    name: str
    section: str = ""
    color: str = "linear-gradient(135deg, #4f46e5, #06b6d4)"


class ClassJoinRequest(BaseModel):
    code: str


class ClassResponse(BaseModel):
    id: int
    name: str
    section: str
    code: str
    color: str
    teacher_id: int
    teacher_name: str
    student_count: int = 0
    assignment_count: int = 0
    is_teacher: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClassMemberResponse(BaseModel):
    student_id: int
    name: str
    email: str
    role: str
    enrolled_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Assignment Schemas ────────────────────────────────────────────────────────

class AssignmentCreateRequest(BaseModel):
    class_id: Optional[int] = None
    title: str
    description: str
    llm_prompt: Optional[str] = None
    rubric_text: Optional[str] = ""
    plagiarism_policy: Optional[str] = None
    max_marks: float = 100.0
    deadline: datetime


class AssignmentUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    llm_prompt: Optional[str] = None
    rubric_text: Optional[str] = None
    plagiarism_policy: Optional[str] = None
    max_marks: Optional[float] = None
    deadline: Optional[datetime] = None
    results_published: Optional[bool] = None


class AssignmentResponse(BaseModel):
    id: int
    class_id: Optional[int] = None
    title: str
    description: str
    llm_prompt: Optional[str] = None
    rubric_text: Optional[str] = ""
    plagiarism_policy: Optional[str] = None
    max_marks: float
    deadline: datetime
    results_published: bool = False
    attachment_name: Optional[str] = None
    has_attachment: bool = False
    cloudinary_url: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Submission Schemas ────────────────────────────────────────────────────────

class SubmissionResponse(BaseModel):
    id: int
    student_id: int
    assignment_id: int
    file_path: str
    cloudinary_url: Optional[str] = None
    submitted_at: datetime
    status: str

    model_config = ConfigDict(from_attributes=True)


# ── Grade Schemas ─────────────────────────────────────────────────────────────

class StudentGradeView(BaseModel):
    """View model for a student looking at their own submission and grade."""
    submission_id: Optional[int] = None
    assignment_id: int
    assignment_title: str
    file_name: Optional[str] = None
    status: str
    marks: Optional[float] = None
    max_marks: Optional[float] = None
    reasoning_text: Optional[str] = None
    submitted_at: Optional[datetime] = None
    graded_at: Optional[datetime] = None


class AdminGradeItem(BaseModel):
    """Full view model for an admin inspecting assignment submissions and grades."""
    grade_id: Optional[int] = None
    submission_id: Optional[int] = None
    student_id: int
    student_name: str
    student_email: str
    assignment_id: int
    marks: Optional[float] = None
    max_marks: Optional[float] = None
    reasoning_text: Optional[str] = None
    flagged: bool = False
    flag_reason: Optional[str] = None
    submission_status: str
    submitted_at: Optional[datetime] = None
    graded_at: Optional[datetime] = None
    manually_edited: bool = False
    edited_by_admin_id: Optional[int] = None
    edited_at: Optional[datetime] = None


class GradePatchRequest(BaseModel):
    """Payload for an admin manually editing a student's grade."""
    marks: Optional[float] = None
    reasoning_text: Optional[str] = None
    flagged: Optional[bool] = None
    flag_reason: Optional[str] = None


class TriggerGradingResponse(BaseModel):
    """Response returned when triggering the grading pipeline."""
    message: str
    assignment_id: int
    processed_count: int
    flagged_count: int
    model_config = ConfigDict(from_attributes=True)


# ── Admin Portal Schemas ──────────────────────────────────────────────────────

class AdminStatsResponse(BaseModel):
    total_users: int
    total_students: int
    total_instructors: int
    total_classes: int
    total_assignments: int
    total_submissions: int
    total_graded: int


class AdminUserItem(BaseModel):
    id: int
    name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: str
    student_id_str: Optional[str] = None
    role: str
    created_at: datetime
    enrolled_classes_count: int = 0
    teaching_classes_count: int = 0
    submissions_count: int = 0


class AdminClassItem(BaseModel):
    id: int
    name: str
    section: Optional[str] = None
    code: str
    color: str
    teacher_id: int
    teacher_name: str
    teacher_email: str
    student_count: int
    assignment_count: int
    created_at: datetime


class AdminSubmissionItem(BaseModel):
    id: int
    assignment_id: int
    assignment_title: str
    class_id: int
    class_name: str
    student_id: int
    student_name: str
    student_email: str
    file_name: str
    status: str
    marks: Optional[float] = None
    max_marks: Optional[float] = None
    flagged: bool = False
    submitted_at: datetime
    graded_at: Optional[datetime] = None
