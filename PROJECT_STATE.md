# PROJECT_STATE.md — Agent Memory

> **Instructions for any AI agent reading this:**
> Read this file FIRST before doing anything. It tells you what already exists,
> key decisions made, and what the next phase should do.
> Update this file before finishing your phase.

---

## Current Phase: Phase 7 Complete → Ready for Phase 8 (Student Frontend)

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
- `app/auth.py` — Password hashing (`bcrypt`) + JWT generation (`python-jose`) + RBAC
- `app/schemas.py` — Pydantic schemas for API requests/responses
- `app/main.py` — FastAPI application with REST endpoints
- `app/pipeline.py` — 7-node LangGraph batch grading workflow
- `app/grading.py` — Claude tool-use single submission grader
- `app/similarity.py` — Plagiarism detector (Token n-gram + AST structural Jaccard)
- `app/notebook_processing.py` — Token-efficient notebook stripper
- **98 automated backend tests passing** across `tests/test_*.py`

### Frontend (`frontend/`)
- React 18 + Vite 5 + Lucide Icons:
  - `vite.config.js` with reverse proxy for `/auth`, `/assignments`, `/submissions`, `/students`, `/admin` to `http://localhost:8000`
  - `src/index.css` — Modern dark glassmorphic design system (Inter, Outfit, JetBrains Mono Google fonts)
  - `src/api.js` — Centralized API client with JWT `localStorage` management and automatic bearer auth
  - `src/components/Navbar.jsx` — Header with user profile, Admin role badge, and logout
  - `src/components/Toast.jsx` — Auto-dismissing notification toasts for user actions
  - `src/components/EditGradeModal.jsx` — Modal for TA to adjust marks, edit reasoning, and toggle similarity flags
  - `src/components/SimilarityFlagModal.jsx` — Modal inspecting detailed plagiarism breakdown, similarity percentages, and matched cell pairs
  - `src/pages/LoginPage.jsx` — Sign in page with quick demo account buttons for Admin TA and Student
  - `src/pages/AdminDashboard.jsx` — Complete admin control center:
    - Assignment selector dropdown
    - Real-time statistics widgets (Total, Graded, Flagged, Average Marks)
    - "Trigger Grading" button with progress spinner and instant direct vs batch API toggle
    - Search & filter bar (search student name/email, filter by status)
    - Interactive grades table with expandable reasoning, status badges, and red plagiarism highlights
  - `src/App.jsx` & `src/main.jsx` — Root router and mount point
  - **Build verified**: `npm run build` succeeds with zero errors in ~13s.

## How to Run Locally

1. **Start the Database**:
   ```powershell
   docker compose up -d
   ```
2. **Start the FastAPI Backend**:
   ```powershell
   cd backend
   .\.venv\Scripts\uvicorn.exe app.main:app --port 8000
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

## What Phase 8 Should Do (Student Frontend)
Build the student-facing portal:
1. Student views list of assignments with submission deadlines and statuses.
2. File upload UI for students to submit `.ipynb` files before deadline (`POST /submissions/upload`).
3. Results page showing **ONLY** the logged-in student's own submission status, awarded marks, and AI feedback (`GET /students/me/grades`).
4. Prevent any display of peer submissions or grades.
