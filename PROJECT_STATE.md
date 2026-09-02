# PROJECT_STATE.md — Agent Memory

> **Instructions for any AI agent reading this:**
> Read this file FIRST before doing anything. It tells you what already exists,
> key decisions made, and what the next phase should do.
> Update this file before finishing your phase.

---

## Current Status: 100% FREE Google Gemini API Integration Complete ✅

The entire platform now supports **Google Gemini 2.0 Flash / 1.5 Flash (100% Free)** with native JSON structured output schema, dual-provider auto-detection, and gentle rate-limit pacing (15 RPM).

---

## What Exists

### Root Level
- `.gitignore` — standard Python + Node ignore rules
- `.env.example` & `.env` — configured with `LLM_PROVIDER=gemini`, `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-2.0-flash`, and instructions
- `docker-compose.yml` — PostgreSQL 16 service (`notebook_grader_db`)
- `README.md` — project overview
- `grading-system-build-plan.md` — master architectural plan
- `PROJECT_STATE.md` — this file

### Backend (`backend/`)
- Python 3.13.2 managed with `uv`
- Core dependencies: `google-genai`, `fastapi`, `uvicorn`, `sqlalchemy[asyncio]`, `asyncpg`, `alembic`, `bcrypt`, `python-jose`, `pydantic-settings`, `anthropic`, `nbformat`, `langgraph`
- Dev dependencies: `pytest`, `pytest-asyncio`, `httpx`, `pytest-cov`
- `app/config.py`:
  - `LLM_PROVIDER: str = "gemini"` (or `"anthropic"`)
  - `GEMINI_API_KEY: str = ""`
  - `GEMINI_MODEL: str = "gemini-2.0-flash"`
  - `ANTHROPIC_API_KEY: str = ""`
- `app/grading.py`:
  - `GeminiGradeSchema(BaseModel)` — Pydantic schema for guaranteed structured output (`marks`, `max_marks`, `reasoning`, `flagged`, `flag_reason`)
  - `grade_with_gemini(...)` — invokes Google Gemini API via official `google-genai` SDK with `response_mime_type="application/json"` and `response_schema=GeminiGradeSchema`
  - `grade_submission(...)` — dual-provider router with auto-detection (uses Gemini by default or when `AIza...` key is provided; falls back to Claude if configured)
- `app/pipeline.py`:
  - 7-node LangGraph orchestration workflow
  - Supports batch grading via Google Gemini with automatic rate-limit pacing (respects 15 RPM free tier) and direct results aggregation
  - Also retains Anthropic Message Batches API support for dual-mode flexibility
- `app/auth.py` — Password hashing (`bcrypt`) + JWT generation (`python-jose`) + RBAC (`admin`, `student`)
- `app/similarity.py` — Dual-engine plagiarism detector (AST structural + Token n-gram Jaccard)
- `app/notebook_processing.py` — Token-efficient notebook preprocessor (~43%+ token savings)
- **100/100 automated backend tests passing** across `tests/test_*.py`

### Frontend (`frontend/`)
- React 18 + Vite 5 + Lucide Icons:
  - `src/index.css` — Modern dark glassmorphic design system
  - `src/api.js` — Centralized API client with JWT `localStorage` management
  - `src/components/Navbar.jsx` — Navigation bar with user profile and Admin/Student view switcher
  - `src/components/EditGradeModal.jsx` — Manual TA grade & reasoning editor
  - `src/components/SimilarityFlagModal.jsx` — Plagiarism breakdown & matched cell pairs inspector
  - `src/pages/LoginPage.jsx` — Authentication with 1-click Quick Demo Fill buttons
  - `src/pages/AdminDashboard.jsx` — Full TA control center (live stats, trigger grading button, table, search/filter)
  - `src/pages/StudentPortal.jsx` — Student workspace with notebook upload, deadline checks, and strictly isolated private feedback
  - **Build verified**: `npm run build` succeeds cleanly with zero errors.

---

## How to Get & Set Up Your Free Gemini Key

1. Go to **[https://aistudio.google.com/](https://aistudio.google.com/)** and sign in with any Google/Gmail account.
2. Click **"Get API key"** -> **"Create API key"** (No credit card or billing needed!).
3. Open `.env` in the project root:
   ```env
   LLM_PROVIDER=gemini
   GEMINI_API_KEY=AIzaSy...your-actual-key-here...
   GEMINI_MODEL=gemini-2.0-flash
   ```
4. **Key Expiry**: Google Gemini API keys **do not expire** unless you manually delete or revoke them in Google AI Studio.
5. **Free Limits**:
   - 15 Requests Per Minute (RPM)
   - 1,500 Requests Per Day (RPD)
   - 1,000,000 Tokens Per Minute (TPM)
   - Completely sufficient to grade 150 students up to 10 times every single day for $0.
