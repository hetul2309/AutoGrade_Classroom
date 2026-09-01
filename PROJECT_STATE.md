# PROJECT_STATE.md — Agent Memory

> **Instructions for any AI agent reading this:**
> Read this file FIRST before doing anything. It tells you what already exists,
> key decisions made, and what the next phase should do.
> Update this file before finishing your phase.

---

## Current Phase: Phase 6 Complete → Ready for Phase 7 (Admin Frontend)

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
- `app/auth.py` (Phase 6):
  - Password hashing with `bcrypt` (`hash_password`, `verify_password`)
  - JWT creation & verification with `python-jose` (`create_access_token`, `get_current_user`)
  - Role-based access control (RBAC): `require_role`, `require_admin`, `require_student`
- `app/schemas.py` (Phase 6):
  - Pydantic models for auth requests, assignments, submissions, student grade view, admin grades table, manual grade editing, and pipeline triggers
- `app/main.py` (Phase 6):
  - FastAPI app with CORS middleware
  - Endpoints:
    - `POST /auth/login` — Authenticates user, returns JWT bearer token + role
    - `GET /auth/me` — Returns currently authenticated user profile
    - `GET /assignments` — Lists assignments with deadlines and rubrics
    - `GET /assignments/{id}` — Fetches single assignment details
    - `POST /submissions/upload` — Student uploads `.ipynb` before deadline, stores file, sets status `pending`
    - `GET /students/me/grades` — **Strict student isolation**: returns only the authenticated student's grades filtered server-side
    - `GET /admin/assignments/{id}/grades` — Admin inspects all submissions, grades, and similarity flags
    - `PATCH /admin/grades/{id}` — Admin manually edits marks/reasoning; records audit trail (`manually_edited=true`, `edited_by_admin_id`)
    - `POST /admin/assignments/{id}/trigger-grading` — Admin triggers Phase 5 LangGraph grading pipeline
- `app/notebook_processing.py` (Phase 2):
  - `process_notebook(path: str) -> NotebookResult` (token savings ~43%+)
- `app/similarity.py` (Phase 3):
  - `find_similar_pairs(submissions, threshold=0.75)` (Token n-gram + AST structural Jaccard)
- `app/grading.py` (Phase 4):
  - `grade_submission(...) -> GradeResult` (Claude tool use for guaranteed JSON)
- `app/pipeline.py` (Phase 5):
  - Compiled LangGraph workflow with 7 nodes:
    `preprocess_node` -> `similarity_check_node` -> `build_grading_requests_node` -> `submit_batch_node` -> `poll_batch_node` -> `parse_results_node` -> `persist_results_node`
  - Anthropic Message Batches API + direct execution support
- `tests/`:
  - `test_notebook_processing.py` — 27 tests
  - `test_similarity.py` — 26 tests
  - `test_grading.py` — 25 tests
  - `test_pipeline.py` — 7 tests
  - `test_api.py` — 13 tests
  - **Total test suite: 98 passing tests** (`.venv\Scripts\python.exe -m pytest tests/ -v`)

## Key Decisions Made
- **Package manager**: `uv`
- **Database**: PostgreSQL 16 via Docker Compose (container: `notebook_grader_db`)
- **Authentication**: JWT tokens signed with HS256, verified in `get_current_user` dependency
- **Security & Authorization**:
  - Role-based dependencies (`require_admin`, `require_student`)
  - Server-side filtering in `GET /students/me/grades` using `current_user.id` so students cannot view any peer grades
  - Deadline validation enforced on uploads
- **Pipeline Orchestration**: LangGraph `StateGraph` triggered via `/admin/assignments/{id}/trigger-grading`

## What Phase 7 Should Do (Admin Frontend)
Build the admin-facing frontend:
1. Tech stack: React + Vite + CSS/Tailwind (clean, modern UI).
2. Login page (email + password -> calls `/auth/login`, stores JWT token).
3. Assignment list page (shows assignments, deadlines, submission count).
4. Per-assignment grades table:
   - Columns: Student Name, Email, Status, Marks, Max Marks, Reasoning, Flagged, Actions
   - Visual badges for submission status (`pending`, `processing`, `graded`, `flagged`, `error`)
   - Expandable reasoning preview
   - Plagiarism highlight if `flagged=true` with flag explanation
   - Inline/modal editing to call `PATCH /admin/grades/{id}`
5. "Trigger Grading" button with loading/progress state to invoke `POST /admin/assignments/{id}/trigger-grading`.

## How to Test Backend API
- Run the 98 automated tests:
  ```powershell
  cd backend
  .\.venv\Scripts\python.exe -m pytest tests/ -v
  ```
- Run the FastAPI server locally:
  ```powershell
  cd backend
  .\.venv\Scripts\uvicorn.exe app.main:app --reload --port 8000
  ```
  Interactive Swagger API documentation will be available at `http://localhost:8000/docs`.
