"""
Tests for backend/app/pipeline.py

Verifies:
1. Each node in the LangGraph pipeline behaves as specified.
2. Full pipeline execution using a mock Anthropic Message Batches client.
3. Similarity detection correctly integrates into the batch workflow.
4. Partial failures (e.g., missing file, bad notebook, batch error) do not crash the batch.
5. Grades and submission statuses persist accurately into PostgreSQL.

Run with:
    .venv\\Scripts\\python.exe -m pytest tests/test_pipeline.py -v
"""

from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest
import pytest_asyncio
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models import Assignment, Grade, Student, Submission, SubmissionStatus, UserRole
from app.pipeline import (
    PipelineState,
    grading_graph,
    preprocess_node,
    similarity_check_node,
    build_grading_requests_node,
    submit_batch_node,
    poll_batch_node,
    parse_results_node,
    persist_results_node,
    run_grading_pipeline,
)
from app.grading import GradeResult
from app.similarity import SimilarityFlag, CellMatch

FIXTURES_DIR = Path(__file__).parent / "fixtures"


# ── Mock Factory for Batches API ──────────────────────────────────────────────

def create_mock_batch_client(custom_id_to_marks: dict[str, float] = None):
    """
    Returns a mock Anthropic client that simulates the Message Batches API:
    - batches.create returns a batch with status 'in_progress'
    - batches.retrieve returns a batch with status 'ended'
    - batches.results yields MessageBatchIndividualResponse mock objects
    """
    if custom_id_to_marks is None:
        custom_id_to_marks = {}

    mock_client = MagicMock()

    batch_obj = MagicMock()
    batch_obj.id = "batch_test_123"
    batch_obj.processing_status = "ended"

    mock_client.messages.batches.create.return_value = batch_obj
    mock_client.messages.batches.retrieve.return_value = batch_obj

    def fake_results(batch_id):
        items = []
        for cid, marks in custom_id_to_marks.items():
            tool_block = MagicMock()
            tool_block.type = "tool_use"
            tool_block.name = "submit_grade"
            tool_block.input = {
                "marks": marks,
                "max_marks": 100.0,
                "reasoning": f"Graded assignment with score {marks}.",
                "flagged": False,
                "flag_reason": None,
            }

            msg = MagicMock()
            msg.content = [tool_block]
            msg.usage = MagicMock()
            msg.usage.input_tokens = 350
            msg.usage.output_tokens = 90

            resp_item = MagicMock()
            resp_item.custom_id = str(cid)
            resp_item.result = MagicMock()
            resp_item.result.type = "succeeded"
            resp_item.result.message = msg
            items.append(resp_item)
        return items

    mock_client.messages.batches.results.side_effect = fake_results
    return mock_client


# ── Fixtures for DB Models ───────────────────────────────────────────────────

from app.database import AsyncSessionLocal, engine
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.config import get_settings

settings = get_settings()

@pytest_asyncio.fixture(autouse=True)
async def cleanup_db_connections():
    """Ensure connections are not shared across separate test event loops."""
    yield
    await engine.dispose()


@pytest_asyncio.fixture
async def sample_assignment():
    """Creates a temporary test assignment in the database."""
    async with AsyncSessionLocal() as session:
        assignment = Assignment(
            title="Test Lab — Gradient Descent",
            description="Implement gradient descent from scratch.",
            rubric_text="1. Gradient descent (50 marks)\n2. MSE loss (50 marks)",
            max_marks=100.0,
            deadline=datetime.now(timezone.utc),
        )
        session.add(assignment)
        await session.commit()
        await session.refresh(assignment)
        assignment_id = assignment.id

    yield assignment

    async with AsyncSessionLocal() as session:
        stmt = select(Assignment).where(Assignment.id == assignment_id)
        res = await session.execute(stmt)
        obj = res.scalar_one_or_none()
        if obj:
            await session.delete(obj)
            await session.commit()


@pytest_asyncio.fixture
async def sample_students():
    """Creates 3 test students in the database."""
    async with AsyncSessionLocal() as session:
        students = [
            Student(name="Test Student 1", email="test1@grading.edu", hashed_password="pw", role=UserRole.student),
            Student(name="Test Student 2", email="test2@grading.edu", hashed_password="pw", role=UserRole.student),
            Student(name="Test Student 3", email="test3@grading.edu", hashed_password="pw", role=UserRole.student),
        ]
        session.add_all(students)
        await session.commit()
        for s in students:
            await session.refresh(s)
        student_ids = [s.id for s in students]

    yield students

    async with AsyncSessionLocal() as session:
        stmt = select(Student).where(Student.id.in_(student_ids))
        res = await session.execute(stmt)
        for obj in res.scalars().all():
            await session.delete(obj)
        await session.commit()


# ══════════════════════════════════════════════════════════════════════════════
# 1. Node Unit Tests
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_preprocess_node_assignment_not_found():
    state: PipelineState = {
        "assignment_id": 999999,
        "submissions": [],
        "errors": [],
    }
    result = await preprocess_node(state)
    assert not result.get("completed", True)
    assert len(result.get("errors", [])) > 0
    assert "not found" in result["errors"][0]


@pytest.mark.asyncio
async def test_preprocess_node_with_missing_and_valid_files(sample_assignment, sample_students):
    # Setup 2 submissions: one with valid file, one missing file
    async with AsyncSessionLocal() as session:
        sub1 = Submission(
            assignment_id=sample_assignment.id,
            student_id=sample_students[0].id,
            file_path=str(FIXTURES_DIR / "lab1_normal.ipynb"),
            status=SubmissionStatus.pending,
        )
        sub2 = Submission(
            assignment_id=sample_assignment.id,
            student_id=sample_students[1].id,
            file_path="non_existent_path.ipynb",
            status=SubmissionStatus.pending,
        )
        session.add_all([sub1, sub2])
        await session.commit()
        await session.refresh(sub1)
        await session.refresh(sub2)

    state: PipelineState = {
        "assignment_id": sample_assignment.id,
        "submissions": [],
        "errors": [],
    }

    result = await preprocess_node(state)
    subs = result["submissions"]
    assert len(subs) == 2

    # sub1 should be cleaned
    s1 = next(s for s in subs if s["submission_id"] == sub1.id)
    assert s1["cleaned_text"] is not None
    assert s1["error"] is None
    assert len(s1["code_cells"]) > 0

    # sub2 should have error
    s2 = next(s for s in subs if s["submission_id"] == sub2.id)
    assert s2["cleaned_text"] is None
    assert s2["error"] is not None


@pytest.mark.asyncio
async def test_similarity_check_node():
    code_a = "def train(X, y):\n    w = 0.0\n    return w"
    code_b = "def train(X, y):\n    w = 0.0\n    return w"
    code_c = "def knn(X, y):\n    return []"

    state: PipelineState = {
        "submissions": [
            {"submission_id": 101, "student_id": 1, "cleaned_text": code_a, "code_cells": [(1, code_a)]},
            {"submission_id": 102, "student_id": 2, "cleaned_text": code_b, "code_cells": [(1, code_b)]},
            {"submission_id": 103, "student_id": 3, "cleaned_text": code_c, "code_cells": [(1, code_c)]},
        ]
    }

    res = await similarity_check_node(state)
    subs = res["submissions"]

    s101 = next(s for s in subs if s["submission_id"] == 101)
    s102 = next(s for s in subs if s["submission_id"] == 102)
    s103 = next(s for s in subs if s["submission_id"] == 103)

    assert s101.get("similarity_flag") is not None
    assert s102.get("similarity_flag") is not None
    assert s103.get("similarity_flag") is None


@pytest.mark.asyncio
async def test_build_grading_requests_node():
    state: PipelineState = {
        "assignment_description": "Lab task",
        "rubric_text": "Rubric text",
        "max_marks": 100.0,
        "model": "claude-sonnet-4-5",
        "submissions": [
            {
                "submission_id": 1,
                "cleaned_text": "code",
                "similarity_flag": None,
                "error": None,
            },
            {
                "submission_id": 2,
                "cleaned_text": None,
                "error": "Failed to read",
            },
        ],
    }

    res = await build_grading_requests_node(state)
    subs = res["submissions"]
    assert subs[0].get("grade_request") is not None
    assert subs[0]["grade_request"]["custom_id"] == "1"
    assert subs[1].get("grade_request") is None


@pytest.mark.asyncio
async def test_submit_and_poll_batch_node():
    mock_client = create_mock_batch_client({"10": 92.0})

    state: PipelineState = {
        "submissions": [
            {"submission_id": 10, "grade_request": {"custom_id": "10", "params": {}}}
        ],
        "client": mock_client,
        "poll_interval_seconds": 0.01,
        "max_poll_seconds": 5.0,
    }

    submit_res = await submit_batch_node(state)
    assert submit_res["batch_id"] == "batch_test_123"

    state.update(submit_res)
    poll_res = await poll_batch_node(state)
    assert poll_res["batch_status"] == "ended"
    assert len(poll_res["raw_batch_results"]) == 1


@pytest.mark.asyncio
async def test_parse_results_node_success_and_error():
    # Setup one succeeded item and one errored item
    tool_block = MagicMock()
    tool_block.type = "tool_use"
    tool_block.name = "submit_grade"
    tool_block.input = {
        "marks": 88.0,
        "max_marks": 100.0,
        "reasoning": "Very well done.",
        "flagged": False,
        "flag_reason": None,
    }
    msg = MagicMock()
    msg.content = [tool_block]
    msg.usage = MagicMock()
    msg.usage.input_tokens = 100
    msg.usage.output_tokens = 50

    item_success = MagicMock()
    item_success.custom_id = "1"
    item_success.result = MagicMock()
    item_success.result.type = "succeeded"
    item_success.result.message = msg

    item_error = MagicMock()
    item_error.custom_id = "2"
    item_error.result = MagicMock()
    item_error.result.type = "errored"
    item_error.result.error = "Model overloaded"

    state: PipelineState = {
        "max_marks": 100.0,
        "submissions": [
            {"submission_id": 1, "error": None},
            {"submission_id": 2, "error": None},
        ],
        "raw_batch_results": [item_success, item_error],
    }

    parsed = await parse_results_node(state)
    subs = parsed["submissions"]

    s1 = next(s for s in subs if s["submission_id"] == 1)
    assert s1.get("grade_result") is not None
    assert s1["grade_result"].marks == 88.0

    s2 = next(s for s in subs if s["submission_id"] == 2)
    assert s2.get("grade_result") is None
    assert s2.get("error") is not None
    assert "Model overloaded" in s2["error"]


# ══════════════════════════════════════════════════════════════════════════════
# 2. Full Pipeline Integration Test
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_full_pipeline_integration(sample_assignment, sample_students):
    """
    Tests the end-to-end pipeline:
    - 3 submissions:
      - Student 1 & Student 2 submit identical notebooks (plagiarized pair)
      - Student 3 submits notebook with an error
    - Verifies:
      - Student 1 & Student 2 are flagged by similarity node and LLM grade persists flagged status.
      - Student 3 gets graded or processed cleanly.
      - Grades land in PostgreSQL.
    """
    normal_nb_path = str(FIXTURES_DIR / "lab1_normal.ipynb")
    error_nb_path = str(FIXTURES_DIR / "lab1_with_errors.ipynb")

    async with AsyncSessionLocal() as session:
        s1 = Submission(
            assignment_id=sample_assignment.id,
            student_id=sample_students[0].id,
            file_path=normal_nb_path,
            status=SubmissionStatus.pending,
        )
        s2 = Submission(
            assignment_id=sample_assignment.id,
            student_id=sample_students[1].id,
            file_path=normal_nb_path,  # identical copy
            status=SubmissionStatus.pending,
        )
        s3 = Submission(
            assignment_id=sample_assignment.id,
            student_id=sample_students[2].id,
            file_path=error_nb_path,
            status=SubmissionStatus.pending,
        )
        session.add_all([s1, s2, s3])
        await session.commit()
        await session.refresh(s1)
        await session.refresh(s2)
        await session.refresh(s3)
        sub1_id, sub2_id, sub3_id = s1.id, s2.id, s3.id

    # Create mock batch client returning specific grades
    mock_client = create_mock_batch_client({
        str(sub1_id): 85.0,
        str(sub2_id): 85.0,
        str(sub3_id): 60.0,
    })

    # Run the full pipeline
    result = await run_grading_pipeline(
        assignment_id=sample_assignment.id,
        client=mock_client,
        poll_interval_seconds=0.01,
        max_poll_seconds=5.0,
    )

    assert result.get("completed") is True

    # Verify Database state
    async with AsyncSessionLocal() as session:
        sub1 = await session.get(Submission, sub1_id)
        sub2 = await session.get(Submission, sub2_id)
        sub3 = await session.get(Submission, sub3_id)

        # Submissions 1 and 2 were identical -> similarity flag -> status flagged
        assert sub1.status == SubmissionStatus.flagged
        assert sub2.status == SubmissionStatus.flagged
        assert sub3.status == SubmissionStatus.graded

        # Verify grades table
        grade1_stmt = select(Grade).where(Grade.submission_id == sub1_id)
        g1 = (await session.execute(grade1_stmt)).scalar_one()
        assert g1.flagged is True
        assert g1.marks == 85.0
        assert g1.flag_reason is not None

        grade2_stmt = select(Grade).where(Grade.submission_id == sub2_id)
        g2 = (await session.execute(grade2_stmt)).scalar_one()
        assert g2.flagged is True
        assert g2.marks == 85.0

        grade3_stmt = select(Grade).where(Grade.submission_id == sub3_id)
        g3 = (await session.execute(grade3_stmt)).scalar_one()
        assert g3.flagged is False
        assert g3.marks == 60.0
