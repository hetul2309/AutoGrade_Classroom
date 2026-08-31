"""
Seed script — creates initial test data for development.

Run with:
    cd backend
    uv run python scripts/seed.py
"""

import asyncio
from datetime import datetime, timedelta, timezone

import bcrypt
from sqlalchemy import select

# Make sure app package is importable from backend/
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import AsyncSessionLocal, engine, Base
from app.models import Student, Assignment, UserRole


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


async def seed():
    # Create all tables (in case migrations haven't been run yet)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # ── Check if already seeded ────────────────────────────────────────
        result = await session.execute(select(Student).limit(1))
        if result.scalar_one_or_none():
            print("Database already seeded. Skipping.")
            return

        # ── Admin user ─────────────────────────────────────────────────────
        admin = Student(
            name="Admin TA",
            email="admin@mlcourse.edu",
            hashed_password=hash_password("admin123"),
            role=UserRole.admin,
        )
        session.add(admin)

        # ── Student users ──────────────────────────────────────────────────
        students = [
            Student(
                name="Alice Patel",
                email="alice@student.edu",
                hashed_password=hash_password("student123"),
                role=UserRole.student,
            ),
            Student(
                name="Bob Shah",
                email="bob@student.edu",
                hashed_password=hash_password("student123"),
                role=UserRole.student,
            ),
            Student(
                name="Carol Mehta",
                email="carol@student.edu",
                hashed_password=hash_password("student123"),
                role=UserRole.student,
            ),
        ]
        session.add_all(students)

        # ── Assignments ────────────────────────────────────────────────────
        assignments = [
            Assignment(
                title="Lab 1 — Linear Regression",
                description=(
                    "Implement linear regression from scratch using NumPy. "
                    "Students must implement gradient descent, compute MSE loss, "
                    "plot the loss curve, and evaluate on a test set."
                ),
                rubric_text=(
                    "Grading breakdown (total 100 marks):\n"
                    "1. Correct gradient descent implementation (30 marks): "
                    "check that weights are updated correctly each epoch.\n"
                    "2. Loss function (MSE) correctly computed (20 marks).\n"
                    "3. Training loop runs without errors (15 marks).\n"
                    "4. Loss curve plotted (15 marks): must show decreasing trend.\n"
                    "5. Test set evaluation reported (10 marks).\n"
                    "6. Code quality and comments (10 marks): readable variable names, "
                    "at least one comment per major step.\n"
                    "Deduct 20 marks if any cell is empty or if the notebook "
                    "does not run top-to-bottom without errors."
                ),
                max_marks=100.0,
                deadline=datetime.now(timezone.utc) - timedelta(days=1),  # past deadline
            ),
            Assignment(
                title="Lab 2 — Classification with Logistic Regression",
                description=(
                    "Implement binary logistic regression with sigmoid activation. "
                    "Train on the provided dataset, plot decision boundary, "
                    "and report accuracy, precision, and recall."
                ),
                rubric_text=(
                    "Grading breakdown (total 100 marks):\n"
                    "1. Sigmoid function correctly implemented (15 marks).\n"
                    "2. Binary cross-entropy loss correct (20 marks).\n"
                    "3. Gradient descent or optimizer used correctly (25 marks).\n"
                    "4. Decision boundary plotted (15 marks).\n"
                    "5. Accuracy, precision, recall all reported (15 marks).\n"
                    "6. Code quality and comments (10 marks).\n"
                    "Deduct 20 marks if notebook does not run top-to-bottom."
                ),
                max_marks=100.0,
                deadline=datetime.now(timezone.utc) + timedelta(days=7),  # upcoming
            ),
        ]
        session.add_all(assignments)

        await session.commit()

        print("SUCCESS: Seed complete!")
        print("\nAccounts created:")
        print("  Admin   -> admin@mlcourse.edu   / admin123")
        print("  Student -> alice@student.edu    / student123")
        print("  Student -> bob@student.edu      / student123")
        print("  Student -> carol@student.edu    / student123")
        print("\nAssignments created:")
        print("  Lab 1 - Linear Regression (deadline: yesterday)")
        print("  Lab 2 - Classification    (deadline: 7 days from now)")


if __name__ == "__main__":
    asyncio.run(seed())
