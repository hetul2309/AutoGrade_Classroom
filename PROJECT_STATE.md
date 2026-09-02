# PROJECT_STATE.md — Agent Memory

> **Instructions for any AI agent reading this:**
> Read this file FIRST before doing anything. It tells you what already exists,
> key decisions made, and what the next phase should do.
> Update this file before finishing your phase.

---

## Current Phase: Phase 8 Complete → Ready for Optional Phase 9 (RAG for Rubrics)

## What Exists

### Root Level
- `.gitignore` — standard Python + Node ignore rules
- `.env.example` — template for secrets (DATABASE_URL, ANTHROPIC_API_KEY, SECRET_KEY)
- `docker-compose.yml` — PostgreSQL 16 service with named volume `postgres_data`
- `README.md` — project overview and quick start
- `grading-system-build-plan.md` — full phased plan from original design
- `PROJECT_STATE.md` — this file

### Backend (`backend/`)
- Python 3.13.2 managed with `uv`
- Core dependencies: `fastapi`, `uvicorn`, `sqlalchemy[asyncio]`, `asyncpg`, `alembic`, `bcrypt`, `python-jose`, `pydantic-settings`, `anthropic`, `nbformat`, `langgraph`
- Dev dependencies: `pytest`, `pytest-asyncio`, `httpx`, `pytest-cov`
- `app/auth.py` — Password hashing (`bcrypt`) + JWT generation (`python-jose`) + RBAC (`require_admin`, `require_student`)
- `app/schemas.py` — Pydantic schemas for auth, assignments, uploads, student grade views, admin tables, manual editing
- `app/main.py` — FastAPI application with REST endpoints
- `app/pipeline.py` — 7-node LangGraph batch grading workflow with Message Batches API
- `app/grading.py` — Claude tool-use single submission grader
- `app/similarity.py` — Plagiarism detector (Token n-gram + AST structural Jaccard)
- `app/notebook_processing.py` — Token-efficient notebook stripper (~43%+ token savings)
- **98 automated backend tests passing** across `tests/test_*.py`

### Frontend (`frontend/`)
- React 18 + Vite 5 + Lucide Icons:
  - `src/index.css` — Modern dark glassmorphic design system (Inter, Outfit, JetBrains Mono)
  - `src/api.js` — Centralized API client with JWT `localStorage` management and automatic bearer auth
  - `src/components/Navbar.jsx` — Header with user profile, role badge, student/admin preview switcher, and logout
  - `src/components/Toast.jsx` — Auto-dismissing notification toasts for user actions
  - `src/components/EditGradeModal.jsx` — Modal for TA to adjust marks, edit reasoning, and toggle similarity flags
  - `src/components/SimilarityFlagModal.jsx` — Modal inspecting detailed plagiarism breakdown, similarity percentages, and matched cell pairs
  - `src/pages/LoginPage.jsx` — Sign in page with 1-click **Quick Demo Fill** buttons for Admin TA and Student
  - `src/pages/AdminDashboard.jsx` — Comprehensive TA control center:
    - Assignment switcher dropdown
    - Live statistics widgets (Total Submissions, Graded, Flagged for Plagiarism, Class Average)
    - "Trigger Grading" button with progress spinner and instant direct vs batch API toggle
    - Search & filter bar (search student name/email, filter by status)
    - Interactive grades table with expandable reasoning, status badges, and red plagiarism highlights
  - `src/pages/StudentPortal.jsx` — Student workspace:
    - **Assignments & Uploads Tab**: view active assignments, deadlines, expandable grading rubrics, and drag-and-drop `.ipynb` notebook uploader with automatic deadline enforcement
    - **My Grades & AI Feedback Tab**: **Strict Student Isolation** — displays only the logged-in student's score, percentage progress bar, detailed AI evaluation feedback, and review notices
  - `src/App.jsx` & `src/main.jsx` — Root router dynamically switching between Admin Dashboard and Student Portal based on user role
  - **Build verified**: `npm run build` succeeds cleanly with zero errors.

---

## How to Run Locally

1. **Start the Database**:
   ```powershell
   docker compose up -d
   ```
2. **Start the FastAPI Backend**:
   ```powershell
   cd backend
   .\.venv\Scripts\uvicorn.exe app.main:app --host 127.0.0.1 --port 8000
   ```
3. **Start the Vite Frontend**:
   ```powershell
   cd frontend
   npm run dev
   ```
   Open your browser to: `http://localhost:5173/`

### Demo Credentials
- **Admin TA**: `admin@mlcourse.edu` / `admin123`
- **Student**: `alice@student.edu` / `student123`

---

## Hardening & Production Checklist
Before deploying for a real university class (e.g. 150+ students):
1. **File Upload Limits**: Configure max file size (e.g. 15MB limit) in FastAPI using middleware or reverse proxy (Nginx) to prevent DOS.
2. **Secrets & CORS**: Replace `SECRET_KEY = "change-this-in-production"` and restrict CORS origins from `*` to the deployed frontend domain.
3. **Cloud Storage**: Transition `file_path` from local disk (`./uploads/`) to S3/GCS bucket storage if deploying on serverless/containers.
4. **Batch Scheduling**: Set up a cron job or Celery task to trigger `run_grading_pipeline(assignment_id)` 24 hours post-deadline automatically.

---

## Optional Phase 9 — RAG for Multi-Assignment Rubrics (Stretch Goal)
1. Store rubric chunks and reference solution code in a vector database (`pgvector` on Postgres).
2. At grading time, retrieve only the rubric sections and reference examples relevant to specific questions or code tasks.
3. Keep retrieval behind a feature flag so flat rubrics continue to work.
