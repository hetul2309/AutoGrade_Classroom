"""
test_api.py
-----------
Comprehensive API test suite for Phase 6 FastAPI backend:
- JWT authentication (login, invalid credentials, unauthenticated rejection)
- Role-based access control (student blocked from admin endpoints with 403)
- Student isolation (student sees ONLY their own grades, server-side enforced)
- Notebook upload (format validation, deadline enforcement)
- Admin grades inspection and manual editing (PATCH /admin/grades/{id})
- Admin grading trigger

Run with:
    .venv\\Scripts\\python.exe -m pytest tests/test_api.py -v
"""

from datetime import datetime, timedelta, timezone
from pathlib import Path
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.auth import create_access_token, hash_password
from app.database import AsyncSessionLocal, engine
from app.main import app
from app.models import Assignment, Grade, Student, Submission, SubmissionStatus, UserRole

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest_asyncio.fixture(autouse=True)
async def cleanup_db_connections():
    """Disposes engine pool between async tests to avoid closed-loop connection reuse."""
    yield
    await engine.dispose()


@pytest_asyncio.fixture
async def api_client():
    """Async HTTP client bound to the FastAPI app."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
        yield client


@pytest_asyncio.fixture
async def seed_users():
    """Seeds 1 admin and 2 students for testing."""
    async with AsyncSessionLocal() as session:
        admin = Student(
            name="Admin User",
            email="admin_test@course.edu",
            hashed_password=hash_password("admin_pass"),
            role=UserRole.admin,
        )
        student_a = Student(
            name="Alice Test",
            email="alice_test@course.edu",
            hashed_password=hash_password("student_pass"),
            role=UserRole.student,
        )
        student_b = Student(
            name="Bob Test",
            email="bob_test@course.edu",
            hashed_password=hash_password("student_pass"),
            role=UserRole.student,
        )
        session.add_all([admin, student_a, student_b])
        await session.commit()
        await session.refresh(admin)
        await session.refresh(student_a)
        await session.refresh(student_b)
        user_ids = [admin.id, student_a.id, student_b.id]

    yield {"admin": admin, "student_a": student_a, "student_b": student_b}

    async with AsyncSessionLocal() as session:
        stmt = select(Student).where(Student.id.in_(user_ids))
        res = await session.execute(stmt)
        for u in res.scalars().all():
            await session.delete(u)
        await session.commit()


@pytest_asyncio.fixture
async def test_assignment():
    """Seeds an active assignment with a future deadline."""
    async with AsyncSessionLocal() as session:
        assignment = Assignment(
            title="Lab 10 — API Test Assignment",
            description="Test task description.",
            rubric_text="Test rubric text.",
            max_marks=100.0,
            deadline=datetime.now(timezone.utc) + timedelta(days=2),
        )
        session.add(assignment)
        await session.commit()
        await session.refresh(assignment)
        assignment_id = assignment.id

    yield assignment

    async with AsyncSessionLocal() as session:
        obj = await session.get(Assignment, assignment_id)
        if obj:
            await session.delete(obj)
            await session.commit()


@pytest_asyncio.fixture
async def expired_assignment():
    """Seeds an assignment with a past deadline."""
    async with AsyncSessionLocal() as session:
        assignment = Assignment(
            title="Expired Lab",
            description="Past deadline assignment.",
            rubric_text="Rubric.",
            max_marks=100.0,
            deadline=datetime.now(timezone.utc) - timedelta(days=2),
        )
        session.add(assignment)
        await session.commit()
        await session.refresh(assignment)
        assignment_id = assignment.id

    yield assignment

    async with AsyncSessionLocal() as session:
        obj = await session.get(Assignment, assignment_id)
        if obj:
            await session.delete(obj)
            await session.commit()


def auth_headers(user: Student) -> dict:
    """Generates an Authorization bearer header dict for a user."""
    token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role.value}
    )
    return {"Authorization": f"Bearer {token}"}


# ══════════════════════════════════════════════════════════════════════════════
# 1. Authentication Tests
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_login_success(api_client, seed_users):
    resp = await api_client.post(
        "/auth/login",
        json={"email": "alice_test@course.edu", "password": "student_pass"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["role"] == "student"
    assert data["email"] == "alice_test@course.edu"


@pytest.mark.asyncio
async def test_login_invalid_password(api_client, seed_users):
    resp = await api_client.post(
        "/auth/login",
        json={"email": "alice_test@course.edu", "password": "wrong_password"},
    )
    assert resp.status_code == 401
    assert "Incorrect email or password" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_login_nonexistent_user(api_client):
    resp = await api_client.post(
        "/auth/login",
        json={"email": "nobody@course.edu", "password": "any"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_profile(api_client, seed_users):
    student = seed_users["student_a"]
    resp = await api_client.get("/auth/me", headers=auth_headers(student))
    assert resp.status_code == 200
    assert resp.json()["id"] == student.id
    assert resp.json()["role"] == "student"


@pytest.mark.asyncio
async def test_unauthenticated_request_rejected(api_client):
    resp = await api_client.get("/students/me/grades")
    assert resp.status_code == 401


# ══════════════════════════════════════════════════════════════════════════════
# 2. Role-Based Access Control (RBAC) Tests
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_student_blocked_from_admin_endpoints(api_client, seed_users, test_assignment):
    student = seed_users["student_a"]
    headers = auth_headers(student)

    # 1. Viewing assignment grades dashboard
    resp = await api_client.get(f"/admin/assignments/{test_assignment.id}/grades", headers=headers)
    assert resp.status_code == 403

    # 2. Patching a grade
    resp = await api_client.patch("/admin/grades/1", json={"marks": 90.0}, headers=headers)
    assert resp.status_code == 403

    # 3. Triggering grading
    resp = await api_client.post(f"/admin/assignments/{test_assignment.id}/trigger-grading", headers=headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_allowed_on_admin_endpoints(api_client, seed_users, test_assignment):
    admin = seed_users["admin"]
    resp = await api_client.get(
        f"/admin/assignments/{test_assignment.id}/grades",
        headers=auth_headers(admin),
    )
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


# ══════════════════════════════════════════════════════════════════════════════
# 3. Student Isolation Tests (Server-Side Filtering)
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_student_cannot_access_other_students_grades(api_client, seed_users, test_assignment):
    """
    CRITICAL SECURITY TEST:
    Verifies that Student A sees ONLY Student A's grades, and never Student B's grades,
    even for the exact same assignment.
    """
    alice = seed_users["student_a"]
    bob = seed_users["student_b"]

    async with AsyncSessionLocal() as session:
        # Enable published results so student grades can be viewed
        db_ass = await session.get(Assignment, test_assignment.id)
        if db_ass:
            db_ass.results_published = True

        # Create Alice's submission + grade
        sub_a = Submission(
            assignment_id=test_assignment.id,
            student_id=alice.id,
            file_path="dummy_alice.ipynb",
            status=SubmissionStatus.graded,
        )
        session.add(sub_a)
        await session.flush()

        grade_a = Grade(
            submission_id=sub_a.id,
            marks=95.0,
            max_marks=100.0,
            reasoning_text="Alice did great.",
            flagged=False,
            graded_at=datetime.now(timezone.utc),
        )
        session.add(grade_a)

        # Create Bob's submission + grade
        sub_b = Submission(
            assignment_id=test_assignment.id,
            student_id=bob.id,
            file_path="dummy_bob.ipynb",
            status=SubmissionStatus.graded,
        )
        session.add(sub_b)
        await session.flush()

        grade_b = Grade(
            submission_id=sub_b.id,
            marks=70.0,
            max_marks=100.0,
            reasoning_text="Bob had bugs.",
            flagged=False,
            graded_at=datetime.now(timezone.utc),
        )
        session.add(grade_b)
        await session.commit()

    # Alice requests her grades
    resp_alice = await api_client.get("/students/me/grades", headers=auth_headers(alice))
    assert resp_alice.status_code == 200
    alice_grades = resp_alice.json()

    # Alice should see exactly 1 grade (hers), with marks=95
    assert len(alice_grades) == 1
    assert alice_grades[0]["submission_id"] == sub_a.id
    assert alice_grades[0]["marks"] == 95.0
    assert alice_grades[0]["reasoning_text"] == "Alice did great."

    # Bob requests his grades
    resp_bob = await api_client.get("/students/me/grades", headers=auth_headers(bob))
    assert resp_bob.status_code == 200
    bob_grades = resp_bob.json()

    # Bob should see exactly 1 grade (his), with marks=70
    assert len(bob_grades) == 1
    assert bob_grades[0]["submission_id"] == sub_b.id
    assert bob_grades[0]["marks"] == 70.0
    assert bob_grades[0]["reasoning_text"] == "Bob had bugs."


# ══════════════════════════════════════════════════════════════════════════════
# 4. Submission Upload Tests
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_upload_submission_success(api_client, seed_users, test_assignment):
    alice = seed_users["student_a"]
    fixture_file = FIXTURES_DIR / "lab1_normal.ipynb"

    with open(fixture_file, "rb") as f:
        resp = await api_client.post(
            "/submissions/upload",
            data={"assignment_id": str(test_assignment.id)},
            files={"file": ("my_lab1.ipynb", f, "application/json")},
            headers=auth_headers(alice),
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["student_id"] == alice.id
    assert data["assignment_id"] == test_assignment.id
    assert data["status"] == "pending"


@pytest.mark.asyncio
async def test_upload_invalid_file_extension(api_client, seed_users, test_assignment):
    alice = seed_users["student_a"]
    resp = await api_client.post(
        "/submissions/upload",
        data={"assignment_id": str(test_assignment.id)},
        files={"file": ("solution.py", b"print('hello')", "text/plain")},
        headers=auth_headers(alice),
    )
    assert resp.status_code == 400
    assert "Only Jupyter notebook files (.ipynb) are allowed" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_upload_after_deadline_rejected(api_client, seed_users, expired_assignment):
    alice = seed_users["student_a"]
    fixture_file = FIXTURES_DIR / "lab1_normal.ipynb"

    with open(fixture_file, "rb") as f:
        resp = await api_client.post(
            "/submissions/upload",
            data={"assignment_id": str(expired_assignment.id)},
            files={"file": ("lab.ipynb", f, "application/json")},
            headers=auth_headers(alice),
        )

    assert resp.status_code == 400
    assert "deadline passed" in resp.json()["detail"].lower()


# ══════════════════════════════════════════════════════════════════════════════
# 5. Admin Grade Management & Editing (PATCH /admin/grades/{id})
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_admin_manual_grade_edit(api_client, seed_users, test_assignment):
    admin = seed_users["admin"]
    alice = seed_users["student_a"]

    async with AsyncSessionLocal() as session:
        sub = Submission(
            assignment_id=test_assignment.id,
            student_id=alice.id,
            file_path="dummy.ipynb",
            status=SubmissionStatus.graded,
        )
        session.add(sub)
        await session.flush()

        grade = Grade(
            submission_id=sub.id,
            marks=75.0,
            max_marks=100.0,
            reasoning_text="Initial LLM reasoning.",
            flagged=False,
            graded_at=datetime.now(timezone.utc),
        )
        session.add(grade)
        await session.commit()
        await session.refresh(grade)
        grade_id = grade.id

    # Admin edits the grade
    resp = await api_client.patch(
        f"/admin/grades/{grade_id}",
        json={
            "marks": 90.0,
            "reasoning_text": "TA review: corrected implementation noted.",
            "flagged": False,
        },
        headers=auth_headers(admin),
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["marks"] == 90.0
    assert data["reasoning_text"] == "TA review: corrected implementation noted."
    assert data["manually_edited"] is True
    assert data["edited_by_admin_id"] == admin.id

    # Verify directly in PostgreSQL
    async with AsyncSessionLocal() as session:
        db_grade = await session.get(Grade, grade_id)
        assert db_grade.marks == 90.0
        assert db_grade.manually_edited is True
        assert db_grade.edited_by_admin_id == admin.id
        assert db_grade.edited_at is not None


@pytest.mark.asyncio
async def test_admin_trigger_grading_endpoint(api_client, seed_users, test_assignment):
    admin = seed_users["admin"]
    resp = await api_client.post(
        f"/admin/assignments/{test_assignment.id}/trigger-grading",
        headers=auth_headers(admin),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "assignment_id" in data
    assert data["assignment_id"] == test_assignment.id
