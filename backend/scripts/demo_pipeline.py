"""
demo_pipeline.py
----------------
Runs the full LangGraph grading pipeline against 3-4 fixture notebooks
with real database persistence in PostgreSQL.

Includes:
- Alice: lab1_normal.ipynb
- Bob: lab1_normal.ipynb (identical to Alice -> deliberately plagiarized pair)
- Carol: lab1_with_errors.ipynb (notebook with runtime errors)

Usage:
    cd backend
    uv run python scripts/demo_pipeline.py [--mock] [--direct]

Flags:
    --mock    Use mock Claude responses (no API key needed, zero cost)
    --direct  Use direct LLM calls instead of Message Batches API (instant result)
"""

import asyncio
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Add backend directory to sys.path
BACKEND_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv
load_dotenv(BACKEND_DIR.parent / ".env")

# Ensure UTF-8 output on Windows consoles
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models import Assignment, Grade, Student, Submission, SubmissionStatus, UserRole
from app.pipeline import run_grading_pipeline
from tests.test_pipeline import create_mock_batch_client

FIXTURES_DIR = BACKEND_DIR / "tests" / "fixtures"


async def setup_demo_data():
    """Sets up an assignment and submissions for demo run."""
    async with AsyncSessionLocal() as session:
        # 1. Fetch or create test assignment
        stmt = select(Assignment).where(Assignment.title == "Demo Lab — Linear Regression")
        assignment = (await session.execute(stmt)).scalar_one_or_none()

        if not assignment:
            assignment = Assignment(
                title="Demo Lab — Linear Regression",
                description=(
                    "Implement linear regression with gradient descent from scratch. "
                    "Compute MSE loss and plot loss curve."
                ),
                rubric_text=(
                    "Grading breakdown (100 marks total):\n"
                    "1. Correct gradient descent implementation (30 marks)\n"
                    "2. MSE loss correct (20 marks)\n"
                    "3. Training loop runs top-to-bottom (15 marks)\n"
                    "4. Loss curve plotted (15 marks)\n"
                    "5. Test set evaluation reported (10 marks)\n"
                    "6. Code quality and comments (10 marks)"
                ),
                max_marks=100.0,
                deadline=datetime.now(timezone.utc),
            )
            session.add(assignment)
            await session.commit()
            await session.refresh(assignment)

        # 2. Fetch existing seeded students
        student_emails = ["alice@student.edu", "bob@student.edu", "carol@student.edu"]
        students_stmt = select(Student).where(Student.email.in_(student_emails))
        students = (await session.execute(students_stmt)).scalars().all()

        if len(students) < 3:
            # Fallback if seed wasn't run
            for email in student_emails:
                s_name = email.split("@")[0].capitalize()
                st = Student(name=s_name, email=email, hashed_password="pw", role=UserRole.student)
                session.add(st)
            await session.commit()
            students = (await session.execute(students_stmt)).scalars().all()

        students_by_email = {s.email: s for s in students}
        alice = students_by_email["alice@student.edu"]
        bob = students_by_email["bob@student.edu"]
        carol = students_by_email["carol@student.edu"]

        # 3. Clean up old submissions for this demo assignment
        old_subs_stmt = select(Submission).where(Submission.assignment_id == assignment.id)
        old_subs = (await session.execute(old_subs_stmt)).scalars().all()
        for os_sub in old_subs:
            await session.delete(os_sub)
        await session.commit()

        # 4. Create fresh submissions
        sub_alice = Submission(
            assignment_id=assignment.id,
            student_id=alice.id,
            file_path=str(FIXTURES_DIR / "lab1_normal.ipynb"),
            status=SubmissionStatus.pending,
        )
        # Bob copies Alice's notebook
        sub_bob = Submission(
            assignment_id=assignment.id,
            student_id=bob.id,
            file_path=str(FIXTURES_DIR / "lab1_normal.ipynb"),
            status=SubmissionStatus.pending,
        )
        # Carol has runtime errors
        sub_carol = Submission(
            assignment_id=assignment.id,
            student_id=carol.id,
            file_path=str(FIXTURES_DIR / "lab1_with_errors.ipynb"),
            status=SubmissionStatus.pending,
        )

        session.add_all([sub_alice, sub_bob, sub_carol])
        await session.commit()
        await session.refresh(sub_alice)
        await session.refresh(sub_bob)
        await session.refresh(sub_carol)

        return assignment, [sub_alice, sub_bob, sub_carol]


async def main():
    print("=" * 70)
    print("      Notebook Grading System — Phase 5 Pipeline Demo")
    print("=" * 70)

    use_mock = "--mock" in sys.argv or not os.environ.get("ANTHROPIC_API_KEY")
    use_direct = "--direct" in sys.argv

    assignment, subs = await setup_demo_data()
    print(f"\n[1/4] Initialized Demo Assignment id={assignment.id}: '{assignment.title}'")
    print(f"      Created 3 test submissions (Alice, Bob, Carol) with status='pending'")

    # Configure client
    mock_client = None
    if use_mock:
        print("\n[2/4] Running with MOCK Claude batch client (zero API cost)...")
        # Pre-configure simulated grades
        mock_client = create_mock_batch_client({
            str(subs[0].id): 92.0,
            str(subs[1].id): 92.0,
            str(subs[2].id): 55.0,
        })
    else:
        mode_str = "Direct Execution" if use_direct else "Anthropic Message Batches API"
        print(f"\n[2/4] Running with REAL Anthropic API ({mode_str})...")

    # Run pipeline
    print("\n[3/4] Executing LangGraph workflow:")
    print("      preprocess_node -> similarity_check_node -> build_grading_requests_node")
    print("      -> submit_batch_node -> poll_batch_node -> parse_results_node -> persist_results_node")

    state = await run_grading_pipeline(
        assignment_id=assignment.id,
        client=mock_client,
        direct_execution=use_direct,
        poll_interval_seconds=1.0,
        max_poll_seconds=60.0,
    )

    print("\n[4/4] Pipeline completed! Querying PostgreSQL for persisted grades:\n")
    print("-" * 70)
    print(f"{'Student':<12} | {'Status':<10} | {'Marks':<10} | {'Flagged':<8} | Reason / Preview")
    print("-" * 70)

    async with AsyncSessionLocal() as session:
        for sub_item in subs:
            db_sub = await session.get(Submission, sub_item.id)
            if not db_sub:
                continue

            grade_stmt = select(Grade).where(Grade.submission_id == db_sub.id)
            grade = (await session.execute(grade_stmt)).scalar_one_or_none()

            student = await session.get(Student, db_sub.student_id)
            s_name = student.name if student else f"Student {db_sub.student_id}"

            marks_str = f"{grade.marks:.1f}/{grade.max_marks:.0f}" if grade else "N/A"
            flagged_str = "YES" if (grade and grade.flagged) else "NO"
            reason = grade.flag_reason or (grade.reasoning_text[:45] + "..." if grade else "No grade")

            print(f"{s_name:<12} | {db_sub.status.value:<10} | {marks_str:<10} | {flagged_str:<8} | {reason}")

    print("-" * 70)
    print("\nSUCCESS: Phase 5 LangGraph orchestration pipeline verified!\n")


if __name__ == "__main__":
    asyncio.run(main())
