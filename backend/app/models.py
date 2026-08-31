import enum
from datetime import datetime

from sqlalchemy import (
    Boolean, DateTime, Enum, Float, ForeignKey,
    Integer, String, Text, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# ── Enums ─────────────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    student = "student"
    admin = "admin"


class SubmissionStatus(str, enum.Enum):
    pending = "pending"         # uploaded, waiting for deadline
    processing = "processing"   # pipeline running
    graded = "graded"           # successfully graded
    flagged = "flagged"         # graded but similarity flag raised
    error = "error"             # pipeline failed for this submission


# ── Models ────────────────────────────────────────────────────────────────────

class Student(Base):
    """
    Represents both students and admin users.
    Role field controls what they can access.
    """
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"), default=UserRole.student, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    submissions: Mapped[list["Submission"]] = relationship(
        "Submission", back_populates="student", cascade="all, delete-orphan"
    )
    edited_grades: Mapped[list["Grade"]] = relationship(
        "Grade", back_populates="edited_by_admin", foreign_keys="Grade.edited_by_admin_id"
    )

    def __repr__(self) -> str:
        return f"<Student id={self.id} email={self.email} role={self.role}>"


class Assignment(Base):
    """
    A lab assignment. Contains the task description and rubric
    that will be sent to the LLM for grading.
    """
    __tablename__ = "assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(
        Text, nullable=False,
        comment="Plain-text description of the task — sent to LLM as context"
    )
    rubric_text: Mapped[str] = mapped_column(
        Text, nullable=False,
        comment="Grading rubric — tells the LLM how to assign marks"
    )
    max_marks: Mapped[float] = mapped_column(Float, nullable=False, default=100.0)
    deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    submissions: Mapped[list["Submission"]] = relationship(
        "Submission", back_populates="assignment", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Assignment id={self.id} title={self.title!r}>"


class Submission(Base):
    """
    A student's uploaded .ipynb file for an assignment.
    One student can have at most one submission per assignment (enforced in API layer).
    """
    __tablename__ = "submissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    assignment_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("assignments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Path or reference to the stored .ipynb file
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    status: Mapped[SubmissionStatus] = mapped_column(
        Enum(SubmissionStatus, name="submission_status"),
        default=SubmissionStatus.pending,
        nullable=False,
        index=True,
    )

    # Relationships
    student: Mapped["Student"] = relationship("Student", back_populates="submissions")
    assignment: Mapped["Assignment"] = relationship("Assignment", back_populates="submissions")
    grade: Mapped["Grade | None"] = relationship(
        "Grade", back_populates="submission", uselist=False, cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Submission id={self.id} student_id={self.student_id} status={self.status}>"


class Grade(Base):
    """
    The grading result for a submission.
    Created by the LLM pipeline; can be manually edited by an admin.
    """
    __tablename__ = "grades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    submission_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("submissions.id", ondelete="CASCADE"), unique=True, nullable=False
    )

    # Grading output
    marks: Mapped[float] = mapped_column(Float, nullable=False)
    max_marks: Mapped[float] = mapped_column(Float, nullable=False)
    reasoning_text: Mapped[str] = mapped_column(
        Text, nullable=False,
        comment="LLM explanation of why this mark was awarded"
    )

    # Plagiarism / similarity flag
    flagged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    flag_reason: Mapped[str | None] = mapped_column(
        Text, nullable=True,
        comment="Explanation if flagged (e.g. 'Cells 3-5 are 92% similar to submission 42')"
    )

    # Timestamps & audit
    graded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    manually_edited: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    edited_by_admin_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("students.id", ondelete="SET NULL"), nullable=True
    )
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    submission: Mapped["Submission"] = relationship("Submission", back_populates="grade")
    edited_by_admin: Mapped["Student | None"] = relationship(
        "Student", back_populates="edited_grades", foreign_keys=[edited_by_admin_id]
    )

    def __repr__(self) -> str:
        return f"<Grade id={self.id} marks={self.marks}/{self.max_marks} flagged={self.flagged}>"
