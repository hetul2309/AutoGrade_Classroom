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


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    name: str
    email: str


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


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
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Submission Schemas ────────────────────────────────────────────────────────

class SubmissionResponse(BaseModel):
    id: int
    student_id: int
    assignment_id: int
    file_path: str
    submitted_at: datetime
    status: str

    model_config = ConfigDict(from_attributes=True)


# ── Grade Schemas ─────────────────────────────────────────────────────────────

class StudentGradeView(BaseModel):
    """View model for a student looking at their own submission and grade."""
    submission_id: int
    assignment_id: int
    assignment_title: str
    file_name: Optional[str] = None
    status: str
    marks: Optional[float] = None
    max_marks: Optional[float] = None
    reasoning_text: Optional[str] = None
    submitted_at: datetime
    graded_at: Optional[datetime] = None


class AdminGradeItem(BaseModel):
    """Full view model for an admin inspecting assignment submissions and grades."""
    grade_id: Optional[int] = None
    submission_id: int
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
    submitted_at: datetime
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
    status: str
    details: Optional[dict] = None
