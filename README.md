# Notebook Grading System

An automated assignment grading system for ML lab notebooks, built for teaching assistants.

## Features (being built phase by phase)
- Students upload `.ipynb` files before deadline
- Automated LLM-based grading (via Anthropic Claude) runs 1 day after deadline
- Plagiarism/similarity detection between submissions
- Admin portal: view all grades, edit manually, see flagged pairs
- Student portal: view only their own results

## Tech Stack
- **Backend**: Python 3.13, FastAPI, SQLAlchemy (async), Alembic
- **Database**: PostgreSQL 16 (via Docker)
- **LLM**: Anthropic Claude API + LangGraph orchestration
- **Frontend**: React (Phase 7+)
- **Package manager**: uv

## Quick Start (after Phase 1)

### 1. Prerequisites
```
Docker Desktop running
Python 3.11+
Node.js 20+
uv installed (pip install uv)
```

### 2. Set up environment
```bash
cp .env.example .env
# Edit .env and fill in your ANTHROPIC_API_KEY and SECRET_KEY
```

### 3. Start the database
```bash
docker compose up -d
```

### 4. Install Python deps & run migrations
```bash
cd backend
uv sync
uv run alembic upgrade head
uv run python scripts/seed.py
```

### 5. Start the backend (Phase 6+)
```bash
uv run uvicorn app.main:app --reload
```

## Project Structure
```
backend/        → FastAPI app, grading logic, preprocessing, similarity detection
frontend/       → React student + admin UI
docker-compose.yml → PostgreSQL container
PROJECT_STATE.md   → Agent memory for multi-session AI-assisted development
```

## Development Phases
See `grading-system-build-plan.md` for the full phased build plan.

- [x] Phase 0 — Prerequisites & scaffolding
- [ ] Phase 1 — Database schema
- [ ] Phase 2 — Notebook preprocessing
- [ ] Phase 3 — Plagiarism detection
- [ ] Phase 4 — LLM grading (single submission)
- [ ] Phase 5 — LangGraph orchestration pipeline
- [ ] Phase 6 — FastAPI backend + auth
- [ ] Phase 7 — Admin frontend
- [ ] Phase 8 — Student frontend
- [ ] Phase 9 — RAG for rubrics (optional stretch)
