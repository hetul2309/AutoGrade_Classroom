# PROJECT_STATE.md — Agent Memory

> **Instructions for any AI agent reading this:**
> Read this file FIRST before doing anything. It tells you what already exists,
> key decisions made, and what the next phase should do.
> Update this file before finishing your phase.

---

## Current Phase: Phase 5 Complete → Ready for Phase 6

## What Exists

### Root Level
- `.gitignore` — standard Python + Node ignore rules
- `.env.example` — template for secrets (DATABASE_URL, ANTHROPIC_API_KEY, SECRET_KEY)
- `docker-compose.yml` — PostgreSQL 16 service with named volume `postgres_data`
- `README.md` — project overview and quick start
- `grading-system-build-plan.md` — full phased plan from original design
- `PROJECT_STATE.md` — this file

### Backend (`backend/`)
- `pyproject.toml` & `uv.lock`:
  - Python 3.13.2 managed with `uv`
  - Core dependencies: `fastapi`, `uvicorn`, `sqlalchemy[asyncio]`, `asyncpg`, `alembic`, `bcrypt`, `python-jose`, `pydantic-settings`, `anthropic`, `nbformat`, `langgraph`
  - Dev dependencies: `pytest`, `pytest-asyncio`, `httpx`, `pytest-cov`
- `app/config.py` — Pydantic Settings loading environment variables
- `app/database.py` — Async SQLAlchemy engine (`AsyncSessionLocal`) & Base model
- `app/models.py` — PostgreSQL schema models:
  - `Student` (id, name, email, hashed_password, role [`student`, `admin`], created_at)
  - `Assignment` (id, title, description, rubric_text, max_marks, deadline, created_at)
  - `Submission` (id, student_id, assignment_id, file_path, submitted_at, status [`pending`, `processing`, `graded`, `flagged`, `error`])
  - `Grade` (id, submission_id, marks, max_marks, reasoning_text, flagged, flag_reason, graded_at, manually_edited, edited_by_admin_id, edited_at)
- `app/notebook_processing.py` (Phase 2):
  - `process_notebook(path: str) -> NotebookResult`
  - Token-efficient stripping of `.ipynb` files (removes execution counts, metadata, drops binary plots with placeholders, truncates outputs > 500 chars)
  - Saves ~43%+ tokens per student notebook
- `app/similarity.py` (Phase 3):
  - `find_similar_pairs(submissions, threshold=0.75) -> list[SimilarityFlag]`
  - Dual-method plagiarism detection: Token n-gram Jaccard + AST structural Jaccard
  - Optimized with per-cell feature caching; scales to 150 students (11,175 pairs) in 0.79s
- `app/grading.py` (Phase 4):
  - `grade_submission(...) -> GradeResult`
  - Uses Claude tool use (`submit_grade` schema) for guaranteed structured JSON output
  - Incorporates pre-computed similarity flags into context
- `app/pipeline.py` (Phase 5):
  - Compiled LangGraph workflow with 7 nodes:
    `preprocess_node` -> `similarity_check_node` -> `build_grading_requests_node` -> `submit_batch_node` -> `poll_batch_node` -> `parse_results_node` -> `persist_results_node`
  - Full support for Anthropic Message Batches API (batch grading entire assignment in one job)
  - Supports direct execution & mock client injection for zero-cost rapid testing
  - Handles per-submission errors cleanly without failing the whole batch
  - Database persistence: updates submission status to `graded`, `flagged`, or `error`, and inserts/updates `Grade` records
  - Public entry point: `run_grading_pipeline(assignment_id, client=..., direct_execution=...)`
- `scripts/`:
  - `seed.py` — Seeds initial admin user and dummy students/assignments
  - `demo_grade.py` — End-to-end single submission test with Claude API
  - `demo_pipeline.py` — End-to-end multi-student batch grading test with Postgres persistence (`uv run python scripts/demo_pipeline.py --mock`)
- `tests/`:
  - `tests/test_notebook_processing.py` — 27 tests (all passing)
  - `tests/test_similarity.py` — 26 tests (all passing)
  - `tests/test_grading.py` — 25 tests (all passing)
  - `tests/test_pipeline.py` — 7 tests (all passing)
  - **Total test suite: 85 passing tests** (`.venv\Scripts\python.exe -m pytest tests/ -v`)

## Key Decisions Made
- **Package manager**: `uv`
- **Database**: PostgreSQL 16 via Docker Compose (container: `notebook_grader_db`)
- **Password Hashing**: Direct `bcrypt` library (avoids passlib incompatibility with Python 3.13)
- **Plagiarism Engine**: Dual-method Token n-gram + AST structural Jaccard with cell caching (0.79s for 150 students)
- **LLM Structured Output**: Claude tool-use forced with `tool_choice="any"`
- **Pipeline Orchestration**: LangGraph `StateGraph` with async execution + Anthropic Message Batches API

## What Phase 6 Should Do (Backend API + Authentication)
Expose the system via a secure FastAPI application:
1. **Authentication**:
   - JWT tokens with `python-jose` + `bcrypt`
   - `POST /auth/login` (email + password returns access token & role)
   - Dependency / security utilities: `get_current_user`, `require_role(UserRole.admin)`
2. **Student Endpoints**:
   - `POST /submissions/upload` (student uploads `.ipynb` file before assignment deadline)
   - `GET /students/me/grades` (student views only their own grades, server-side filtered)
3. **Admin Endpoints**:
   - `GET /admin/assignments/{id}/grades` (admin views full grades table with student details and similarity flags)
   - `PATCH /admin/grades/{id}` (admin manually edits marks/reasoning; records `manually_edited=true`, `edited_by_admin_id`, `edited_at`)
   - `POST /admin/assignments/{id}/trigger-grading` (triggers Phase 5's `run_grading_pipeline(assignment_id)`)
4. **API Tests**:
   - Write pytest + httpx tests covering auth, student isolation (cannot access others' grades), admin edits, and pipeline trigger.

## How to Test
- Run all 85 tests:
  ```powershell
  cd backend
  .\.venv\Scripts\python.exe -m pytest tests/ -v
  ```
- Run the full pipeline demo against PostgreSQL:
  ```powershell
  cd backend
  .\.venv\Scripts\python.exe scripts/demo_pipeline.py --mock
  ```
