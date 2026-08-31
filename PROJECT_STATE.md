# PROJECT_STATE.md — Agent Memory

> **Instructions for any AI agent reading this:**
> Read this file FIRST before doing anything. It tells you what already exists,
> key decisions made, and what the next phase should do.
> Update this file before finishing your phase.

---

## Current Phase: Phase 0 Complete → Ready for Phase 1

## What Exists

### Root Level
- `.gitignore` — standard Python + Node ignore rules
- `.env.example` — template for secrets (DATABASE_URL, ANTHROPIC_API_KEY, SECRET_KEY)
- `docker-compose.yml` — PostgreSQL 16 service with named volume `postgres_data`
- `README.md` — project overview and quick start
- `grading-system-build-plan.md` — full phased plan from original design
- `PROJECT_STATE.md` — this file

### Folder Structure (scaffolded, mostly empty)
```
backend/
  app/             ← FastAPI app will go here
  alembic/
    versions/      ← Alembic migration files will go here
  tests/
    fixtures/      ← Sample .ipynb files for testing
  scripts/         ← seed.py and utility scripts
frontend/
  src/
    pages/
    components/
```

## Key Decisions Made
- **Package manager**: `uv` (faster than pip/poetry)
- **Python version**: 3.13.2 (already installed on system)
- **Node version**: 20.20.2 (already installed)
- **Database**: PostgreSQL 16 via Docker Compose
- **LLM**: Anthropic Claude API (primary)
- **Docker**: needs to be installed — user is on Windows, use Docker Desktop

## What Phase 1 Should Do
1. Create `backend/pyproject.toml` with uv + all Phase 1 deps:
   - fastapi, uvicorn[standard], sqlalchemy[asyncio], asyncpg, alembic, passlib[bcrypt], python-jose, python-dotenv, pydantic-settings
2. Create `backend/app/database.py` — async SQLAlchemy engine + session factory
3. Create `backend/app/models.py` — all 4 tables: students, assignments, submissions, grades
4. Initialize Alembic (`alembic init alembic` inside backend/) and configure `alembic.ini` + `env.py` to use the async engine
5. Generate + run first migration
6. Create `backend/scripts/seed.py` — 1 admin, 2 students, 1 assignment
7. Update this PROJECT_STATE.md

## Environment Notes
- OS: Windows 11
- Shell: PowerShell
- Working directory for all commands: `c:\Users\Hetul\Desktop\HK\Coding\Notebook_Grading_System`
- Backend commands: `cd backend && uv run <command>`

## Future Merge Notes
- A second TA is building a quiz platform that may merge with this project later
- Keep all code namespaced under `backend/` (not flat at root)
- Auth/JWT layer should be designed to support multiple user roles from day 1
