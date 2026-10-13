# AutoGrade Classroom — Intelligent Notebook Grading System

An intelligent, full-stack assignment management and automated evaluation system for Jupyter Notebooks (`.ipynb`), designed for educators, teaching assistants, and students.

AutoGrade Classroom combines Google Classroom-style course management with AI-powered grading (Google Gemini), dual-engine code plagiarism detection, real-time evaluation dashboards, and teacher review workflows.

---

## Key Features

### 1. Classroom & Assignment Management
* **Google Classroom-Style Hub:** Create classes, generate unique class codes, invite co-teachers, and manage enrolled students.
* **Student Self-Enrollment:** Students can join any class instantly using its class code.
* **Rich Assignments:** Publish assignments with lab handout attachments (PDFs/docs), submission deadlines, private LLM prompts, academic marking rubrics, and custom cheating/plagiarism policies.
* **Assignment Deletion & Management:** Teachers and co-teachers can safely delete assignments with interactive confirmation dialogs, automatically cascading the removal of all student notebook submissions, evaluations, and uploaded cloud/local files.
* **Handout Storage:** Automated Cloudinary cloud storage integration with local storage fallback.

### 2. Intelligent AI Grading Engine
* **Google Gemini Integration (100% Free Tier Supported):** Powered by Gemini 2.0 Flash / 1.5 Flash with native JSON structured output (`GeminiGradeSchema`) for consistent marks and reasoning.
* **Multi-Model Reliability:** Automatic model rotation and graceful failover across Google Gemini models (Gemini 2.5 Flash / 3.8 Flash / Flash Latest).
* **Rate-Limit Pacing & Rotation:** Automatic request pacing (15 RPM) and multi-key fallback handling to maximize throughput within free-tier quotas.
* **Token-Efficient Preprocessor:** Cleans ANSI codes, strips excessive outputs, and truncates large payloads before prompt injection (~43%+ token savings).
* **LangGraph Orchestration:** 7-node grading pipeline that coordinates preprocessing, plagiarism scanning, LLM evaluation, and database persistence.
* **Strict Teacher Control:** **No unauthorized automatic grading.** Grading is strictly manual—it only runs when an instructor clicks **"Grade Pending"** or **"Recheck All"**.

### 3. Dual-Engine Plagiarism Detection
* **AST Structural Analysis:** Compares Abstract Syntax Trees across student code to catch renamed variables, altered comments, and reordered operations.
* **Token N-Gram Jaccard Similarity:** Detects lexical copying and logic replication across notebook cells.
* **Similarity Inspector:** Visual breakdown of flagged pairs with matched code cell side-by-side inspection for manual TA review.

### 4. Teacher Evaluation & Review Dashboard
* **Real-Time Grading Table:** Filter students by status (`Graded`, `Pending`, `Flagged`, `No Submission`) and search by name, student ID, or email.
* **Manual Overrides & Audit Trail:** Teachers can manually adjust marks, edit AI reasoning, or toggle copy flags with timestamps and teacher ID logging.
* **Live Recheck System:** Single-student re-evaluation or batch **"Recheck All"** using updated rubrics and prompts.
* **Publish/Unpublish Workflow:** Grades and AI feedback remain completely private until the teacher reviews and publishes them to students.
* **Bulk Exports:**
  * Download all student notebook files in a single `.zip` archive.
  * Export student grades, submission timestamps, and AI feedback to Excel `.csv`.

### 5. Student Portal
* **Clean Student Workspace:** View enrolled classes, deadlines, and assignment handouts.
* **Notebook Turn-In:** Upload `.ipynb` notebooks with drag-and-drop support.
* **Resubmission Window:** Replace turned-in files at any time before the deadline.
* **Private Feedback View:** View scores, rubric breakdown, and AI feedback once published by the instructor.

### 6. Modern Glassmorphic UI
* Fast, reactive SPA built with React 18 and Vite.
* Sleek dark and light themes with automatic system synchronization and persistent toggle.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Backend Framework** | Python 3.13, FastAPI, Uvicorn |
| **Database & ORM** | PostgreSQL 16 (Local Docker or Serverless Neon PostgreSQL), SQLAlchemy 2.0 (Async), Asyncpg, Alembic |
| **AI / LLM** | Google Gemini SDK (`google-genai`), LangGraph |
| **Notebook Parsing** | `nbformat`, AST parser |
| **Cloud Storage** | Cloudinary API |
| **Frontend** | React 18, Vite 5, Lucide Icons, Vanilla CSS Glassmorphism |
| **Package Managers** | `uv` (Python), `npm` (Node.js) |

---

## Project Structure

```
Notebook_Grading_System/
├── backend/
│   ├── app/
│   │   ├── config.py             # App configuration & environment settings
│   │   ├── database.py           # Async SQLAlchemy engine & session maker
│   │   ├── models.py             # Database models (User, Class, Assignment, Submission, Grade)
│   │   ├── schemas.py            # Pydantic schemas (Request/Response DTOs)
│   │   ├── auth.py               # Password hashing, JWT token handling, RBAC
│   │   ├── grading.py            # Google Gemini LLM grading engine
│   │   ├── pipeline.py           # LangGraph evaluation pipeline
│   │   ├── similarity.py         # AST & N-gram plagiarism detection
│   │   ├── notebook_processing.py# Token-efficient notebook preprocessing
│   │   ├── email_service.py      # Notification service (SMTP / Resend / Brevo)
│   │   └── main.py               # FastAPI application routes and handlers
│   ├── alembic/                  # Database migration scripts
│   ├── uploads/                  # Local storage fallback directory
│   └── pyproject.toml            # Backend dependencies
├── frontend/
│   ├── src/
│   │   ├── api.js                # Centralized API client with JWT interceptors
│   │   ├── components/           # UI Modals, Navbar, Toast, Spinners
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx     # Authentication with Quick-Fill demo buttons
│   │   │   ├── ClassroomPage.jsx # Class cards, create/join class modal
│   │   │   ├── ClassDetailPage.jsx # Classwork, Evaluation table, People tabs
│   │   │   ├── AdminDashboard.jsx# Global TA evaluation dashboard
│   │   │   └── StudentPortal.jsx # Student assignment view
│   │   └── index.css             # Glassmorphic design system (Dark & Light)
│   └── package.json              # Frontend dependencies
├── docker-compose.yml            # PostgreSQL container for local dev
└── README.md                     # Project documentation (this file)
```

---

## Quick Start Guide

### 1. Prerequisites
* **Python**: 3.11+ (Python 3.13 recommended)
* **Node.js**: 20+
* **Package Manager**: `uv` for Python (`pip install uv`)
* **Database**: Docker Desktop (for local PostgreSQL) OR a free [Neon Serverless PostgreSQL](https://neon.tech/) account.

---

### 2. Environment Configuration

Create a `.env` file in the project root:

```env
# ── Database ──────────────────────────────────────────────────────────────────
# Local Docker:
DATABASE_URL=postgresql+asyncpg://grader:grader_password@localhost:5432/notebook_grader
# Or Neon Serverless PostgreSQL:
# DATABASE_URL=postgresql+asyncpg://<user>:<password>@<host>/<dbname>?ssl=require

# ── LLM Settings ─────────────────────────────────────────────────────────────
LLM_PROVIDER=gemini
GEMINI_API_KEY=AIzaSy...your-gemini-key-from-aistudio...
GEMINI_MODEL=gemini-2.0-flash

# ── Auth & Security ──────────────────────────────────────────────────────────
SECRET_KEY=generate-a-secure-random-secret-key-here
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# ── Cloudinary Storage (Optional - falls back to local uploads) ───────────────
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret

# ── App Settings ─────────────────────────────────────────────────────────────
ENVIRONMENT=development
UPLOAD_DIR=./uploads
```

> **How to get a Free Gemini API Key:**
> 1. Visit [Google AI Studio](https://aistudio.google.com/).
> 2. Click **"Get API key"** -> **"Create API key"** (no credit card required).
> 3. Paste the key into `GEMINI_API_KEY` in `.env`.

---

### 3. Database Setup

#### Option A: Local PostgreSQL (Docker)
```bash
docker compose up -d
```

#### Option B: Cloud Database (Neon / Render)
Simply paste your database connection string into `DATABASE_URL` in `.env` (using `postgresql+asyncpg://...`).

Run Alembic migrations:
```bash
cd backend
uv run alembic upgrade head
```

*(Optional) Seed mock users & classes:*
```bash
uv run python scripts/seed.py
```

---

### 4. Running the Backend

```bash
cd backend
uv run uvicorn app.main:app --reload --port 8000
```
* **API Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
* **OpenAPI Schema**: [http://localhost:8000/openapi.json](http://localhost:8000/openapi.json)

---

### 5. Running the Frontend

```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Evaluation Workflow

```
1. Instructor publishes assignment with rubric, max marks & handout.
                         │
                         ▼
2. Students upload .ipynb notebooks before deadline.
   (Status: 'pending' — NO automated grading runs yet).
                         │
                         ▼
3. Instructor opens "Notebook Evaluation & Grading" tab.
   Clicks "Grade Pending" or "Recheck All".
                         │
                         ▼
4. LangGraph Pipeline executes:
   ├── Code preprocessor cleans notebook payloads
   ├── AST + N-gram plagiarism scanner compares submissions
   └── Gemini LLM evaluates code against the custom rubric
                         │
                         ▼
5. Instructor reviews evaluation table:
   ├── Inspects copy-case alerts and matched code cells
   ├── Edits marks or feedback manually if needed
   └── Clicks "Publish Results to Students"
                         │
                         ▼
6. Students receive their marks and private AI feedback.
```

---

## Maintenance & Documentation Policy

> **Important Note for Developers and AI Agents:**
> Whenever significant architectural changes, new endpoints, database migrations, or major frontend features are introduced, **this `README.md` must be updated** in the same change to maintain accurate, up-to-date documentation.
