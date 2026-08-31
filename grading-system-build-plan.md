# Notebook Grading System — Phased Build Plan

## How to use this document

Each phase below is a **self-contained prompt** you paste into Claude Code (or another
coding agent) as a fresh session. Do not try to run multiple phases in one prompt —
each is scoped to be completable and reviewable in one sitting.

**The key trick that makes multi-session work possible:** after Phase 1, every prompt
tells the agent to read a file called `PROJECT_STATE.md` before doing anything, and to
update it before finishing. This file lives in your project folder and acts as the
agent's memory across sessions — since a new Claude Code session doesn't remember
your previous conversation, this file is how it "catches up."

**Your job between phases:** skim the diff/output, run the app, sanity check it, commit
to git, *then* move to the next phase. Don't chain phases back-to-back without checking.

---

## Phase 0 — Prerequisites (you do this manually, ~15 min)

- Install Docker Desktop
- Install Python 3.11+ and Node.js 20+
- Create an empty git repo for the project, e.g. `notebook-grader/`
- Get your Anthropic API key from the Claude Console (platform.claude.com) and save it
  somewhere safe — you'll paste it into a `.env` file the agent creates, never into code.

---

## Phase 1 — Project scaffolding + database schema

```
I'm building a notebook-grading system for a machine learning course. Set up the
foundational project structure and database. This is Phase 1 of a multi-phase build —
create a PROJECT_STATE.md file at the project root that summarizes what exists so far,
key decisions made, and what the next phase should do. Update this file at the end.

Stack:
- Backend: Python, FastAPI, SQLAlchemy (async), Alembic for migrations
- Database: PostgreSQL, run via docker-compose for local dev
- Package management: uv or poetry (your choice, note which in PROJECT_STATE.md)

Tasks:
1. Create a clean project folder structure (backend/, frontend/ placeholder,
   docker-compose.yml, .env.example, README.md).
2. docker-compose.yml should spin up Postgres 16 with a named volume.
3. Design and implement the initial database schema via SQLAlchemy models + an
   Alembic migration, covering:
   - students (id, name, email, hashed_password, role [student/admin])
   - assignments (id, title, description, rubric_text, deadline, created_at)
   - submissions (id, student_id FK, assignment_id FK, file_path or storage_ref,
     submitted_at, status [pending/processing/graded/flagged])
   - grades (id, submission_id FK, marks, max_marks, reasoning_text, flagged bool,
     flag_reason text nullable, graded_at, manually_edited bool, edited_by_admin_id
     FK nullable)
4. Write a simple seed script that creates one admin user and a couple of dummy
   students/assignments for testing.
5. Set up .env.example with placeholders for DATABASE_URL and ANTHROPIC_API_KEY.
6. Write clear setup instructions in README.md (docker compose up, run migrations,
   run seed script).

Do not build any API endpoints, frontend, or LLM logic yet — this phase is purely
project scaffolding and the database layer. Confirm the schema with me by showing
it before running the migration, in case I want to tweak column choices.
```

---

## Phase 2 — Notebook preprocessing module

```
Read PROJECT_STATE.md first to understand what exists. This is Phase 2: build a
standalone, well-tested notebook preprocessing module. Do not touch the database,
API, or frontend in this phase.

Goal: given a raw .ipynb file, produce a clean, token-efficient plain-text
representation suitable for sending to an LLM.

Requirements:
1. Use the `nbformat` library to parse .ipynb files.
2. Extract cells in order, preserving cell_type (code vs markdown) and source text.
3. For code cell outputs: keep short text/stdout outputs (e.g., print results,
   short error tracebacks) but TRUNCATE anything over ~500 characters, and
   completely DROP image outputs (image/png, image/jpeg) and other binary
   outputs — replace them with a placeholder like "[image output omitted]".
4. Strip notebook/cell metadata, execution_count, and cell IDs — none of this is
   useful for grading.
5. Output format: a clean text document with clear cell delimiters, e.g.:
   "### Cell 1 [code] ###\n<source>\n--- output ---\n<truncated output>\n"
6. Write this as a proper Python module (e.g., backend/app/notebook_processing.py)
   with a single clear function: `process_notebook(path: str) -> str`.
7. Write unit tests using a few sample .ipynb fixtures (create 2-3 small fixture
   notebooks covering: plain code, code with plot output, code with error output,
   markdown cells).
8. Report approximate token count before/after stripping using Anthropic's token
   counting API or a simple tiktoken-style estimate, so I can see the savings.

Update PROJECT_STATE.md when done, noting this module's location and how to run
its tests.
```

---

## Phase 3 — Plagiarism / similarity detection engine

```
Read PROJECT_STATE.md first. This is Phase 3: build a standalone similarity
detection module. Do not integrate with the database, API, or LLM calls yet.

Goal: given a folder of preprocessed (already-stripped, code-only) submissions,
detect pairs of submissions that are suspiciously similar, without using an LLM.

Requirements:
1. Extract only code cells (ignore markdown/comments) for comparison purposes.
2. Implement similarity scoring using a combination of:
   - Token-based similarity (e.g., using difflib.SequenceMatcher or a Jaccard
     index over normalized code tokens)
   - Optionally, AST-based structural comparison for Python code (using the
     `ast` module) to catch renamed-variable plagiarism, not just literal copies
3. Compare every submission against every other submission for a given
   assignment (pairwise), and return a ranked list of pairs above a configurable
   similarity threshold (default e.g. 0.75).
4. For each flagged pair, output which specific cells matched and a
   human-readable explanation (e.g., "Cells 3-5 are 92% similar to submission
   from student_id=42").
5. Write this as backend/app/similarity.py with a clear function like:
   `find_similar_pairs(submissions: list[SubmissionText], threshold: float) ->
   list[SimilarityFlag]`
6. Write unit tests with deliberately near-identical and deliberately different
   fake code snippets to confirm the detector behaves correctly at the threshold
   boundary.
7. Note performance: with ~150 students this is ~11,000 pairwise comparisons per
   assignment — make sure it runs in a few seconds, not minutes. Mention Big-O
   in your summary.

Update PROJECT_STATE.md when done.
```

---

## Phase 4 — LLM grading module (single submission)

```
Read PROJECT_STATE.md first. This is Phase 4: build the module that grades ONE
student's preprocessed notebook using the Claude API. Do not build batch
processing or LangGraph orchestration yet — that's Phase 5.

Requirements:
1. Use the official Anthropic Python SDK.
2. Use Claude's structured outputs feature so the response is guaranteed valid
   JSON matching this schema:
   { "marks": number, "max_marks": number, "reasoning": string,
     "flagged": boolean, "flag_reason": string | null }
3. Construct the prompt from: the assignment's rubric_text, the assignment
   description/task, the preprocessed notebook text (from Phase 2's module),
   and any pre-computed similarity flag from Phase 3 (pass it in as context so
   the model can factor it into its flagged/flag_reason fields, but the model
   should NOT be responsible for detecting plagiarism itself — only for
   incorporating a flag it's given).
4. Write this as backend/app/grading.py with a function like:
   `grade_submission(rubric: str, task_description: str, notebook_text: str,
   similarity_flag: SimilarityFlag | None) -> GradeResult`
5. Handle errors gracefully: malformed model output, API errors, timeouts —
   log clearly and raise a typed exception rather than crashing silently.
6. Write a small test/demo script that grades one of the fixture notebooks from
   Phase 2 end to end and prints the result, so I can sanity check grading
   quality on a real example before scaling up.

Update PROJECT_STATE.md when done.
```

---

## Phase 5 — Orchestration pipeline (LangGraph + Batch API)

```
Read PROJECT_STATE.md first. This is Phase 5: wire Phases 2-4 together into a
single orchestrated pipeline using LangGraph, and integrate the Anthropic
Message Batches API so all students for an assignment can be graded in one
batch job instead of one-by-one.

Requirements:
1. Build a LangGraph graph with nodes: preprocess_node -> similarity_check_node
   -> build_grading_requests_node -> submit_batch_node -> poll_batch_node ->
   parse_results_node -> persist_results_node.
2. similarity_check_node should run once across ALL submissions for an
   assignment (not per-student) and attach flags to individual submissions
   before they proceed.
3. submit_batch_node should build one Batch API request per student and submit
   them together as a single batch job (see Anthropic's Message Batches API
   docs for the request format).
4. poll_batch_node should poll for batch completion (batches can take up to
   ~24h, though usually much faster) and handle partial failures per-request
   without failing the whole batch.
5. persist_results_node writes grades into the `grades` table from Phase 1's
   schema (submissions marked pending -> graded/flagged).
6. Expose a single entry point function, e.g. `run_grading_pipeline(assignment_id)`,
   that a scheduled job or API call can trigger the day after a deadline.
7. Write an integration test (can be a manual test script, doesn't need to be
   automated) that runs the full pipeline against 3-4 fixture notebooks,
   including at least one deliberately-plagiarized pair, and confirms flags
   and grades land in the database correctly.

Update PROJECT_STATE.md when done, including how to manually trigger a pipeline
run for testing.
```

---

## Phase 6 — Backend API + authentication

```
Read PROJECT_STATE.md first. This is Phase 6: build the FastAPI endpoints and
authentication layer. The grading pipeline logic already exists from Phase 5 —
this phase just exposes it and the data through a secured API.

Requirements:
1. Authentication: JWT-based login (email + password, use passlib for hashing).
   Two roles: student, admin.
2. Endpoints (all behind auth):
   - POST /auth/login
   - POST /submissions/upload (student uploads their .ipynb for an assignment
     before deadline; store file, create submission row as 'pending')
   - GET /students/me/grades (student sees ONLY their own grades — enforce this
     by filtering on the authenticated user's id server-side, never trust a
     client-supplied student_id)
   - GET /admin/assignments/{id}/grades (admin sees full table: student, marks,
     reasoning, flagged status, for all students on that assignment)
   - PATCH /admin/grades/{id} (admin edits marks/reasoning manually; record
     manually_edited=true and edited_by_admin_id)
   - POST /admin/assignments/{id}/trigger-grading (kicks off Phase 5's pipeline)
3. Enforce role-based access control with a dependency/decorator, not ad-hoc
   checks scattered in each endpoint.
4. Write API tests (pytest + httpx) covering: a student cannot access another
   student's grades even if they guess the ID, an admin can edit a grade, and
   an unauthenticated request is rejected.

Update PROJECT_STATE.md with the full endpoint list and auth flow summary.
```

---

## Phase 7 — Admin frontend

```
Read PROJECT_STATE.md first. This is Phase 7: build the admin-facing frontend.

Requirements:
1. Use React + a simple styling approach (Tailwind is fine).
2. Login page.
3. Assignment list page.
4. Per-assignment grades table: student name, marks, reasoning (expandable/
   truncated with "show more"), flagged (visually highlighted row if true),
   with each row editable inline or via a modal (calls the PATCH endpoint from
   Phase 6).
5. A "Trigger grading" button on the assignment page, calling the trigger
   endpoint from Phase 6, with a loading/progress state since batch grading
   isn't instant.
6. Keep this frontend simple and functional — polish is not the priority yet.

Update PROJECT_STATE.md when done.
```

---

## Phase 8 — Student frontend

```
Read PROJECT_STATE.md first. This is Phase 8: build the student-facing
frontend.

Requirements:
1. Login page (shared login logic with admin frontend is fine if you built it
   as a shared app in Phase 7 — otherwise keep consistent styling).
2. Assignment list with submit/upload UI for .ipynb files before deadline.
3. A results page showing ONLY the logged-in student's own grade, marks, and
   reasoning for each assignment — do not expose any endpoint or UI path that
   could reveal other students' data.
4. Simple, clean, functional UI — no need for elaborate design.

Update PROJECT_STATE.md when done. At this point the core product loop should
be complete end to end; note anything you'd flag for cleanup or hardening
before real student use (e.g., env var handling, error states, file size limits
on upload).
```

---

## Optional Phase 9 — RAG for multi-assignment rubrics (stretch/demo goal)

Only worth doing once the core system works, and mainly useful if you want to
explicitly demonstrate RAG for your project write-up.

```
Read PROJECT_STATE.md first. This is an optional Phase 9: replace the flat
rubric_text lookup with a retrieval step, useful once there are many
assignments/rubrics stored.

Requirements:
1. Chunk and embed rubric + reference-solution documents (use Voyage AI or any
   embedding model) into a vector store (pgvector extension on the existing
   Postgres instance is the simplest choice — no new infra needed).
2. At grading time, retrieve only the rubric chunks relevant to the specific
   assignment/task rather than passing the full rubric text, and log retrieval
   results so I can inspect what was retrieved.
3. Keep this behind a feature flag so the flat-lookup approach from earlier
   phases still works if I don't need retrieval for a given assignment.

Update PROJECT_STATE.md when done.
```

---

## Notes for you (not for the agent)

- Do Phase 1 and check the schema before moving on — it's the hardest thing to
  change later.
- After Phase 4, actually read the grading output on a real notebook. If the
  reasoning quality isn't good enough, iterate on the rubric/prompt wording
  before building the pipeline around it in Phase 5.
- Commit to git after every phase. If a phase goes wrong, you want to roll back
  cleanly rather than debug a half-broken multi-phase mess.
