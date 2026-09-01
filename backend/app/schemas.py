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


# ── Assignment Schemas ────────────────────────────────────────────────────────

class AssignmentResponse(BaseModel):
    id: int
    title: str
    description: str
    rubric_text: str
    max_marks: float
    deadline: datetime
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
