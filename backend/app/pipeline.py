"""
pipeline.py
-----------
LangGraph orchestration pipeline for batch grading all submissions for an assignment.

Requirements satisfied:
1. LangGraph graph with nodes:
   preprocess_node -> similarity_check_node -> build_grading_requests_node ->
   submit_batch_node -> poll_batch_node -> parse_results_node -> persist_results_node
2. similarity_check_node runs once across ALL submissions for an assignment.
3. submit_batch_node builds batch requests using Anthropic's Message Batches API.
4. poll_batch_node polls for batch completion and handles partial failures per request.
5. persist_results_node writes grades to the PostgreSQL database and updates submission statuses.
6. Single entry point function: `run_grading_pipeline(assignment_id)`.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, TypedDict

import anthropic
from langgraph.graph import END, StateGraph
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.grading import (
    _GRADE_TOOL,
    GradeResult,
    GradingError,
    GradingParseError,
    _build_system_prompt,
    _build_user_prompt,
    _extract_tool_input,
    _parse_grade_result,
    grade_with_gemini,
)
from app.models import Assignment, Grade, Submission, SubmissionStatus
from app.notebook_processing import process_notebook
from app.similarity import SimilarityFlag, SubmissionText, find_similar_pairs

logger = logging.getLogger(__name__)
settings = get_settings()


# ── State Schema ─────────────────────────────────────────────────────────────

class SubmissionItem(TypedDict, total=False):
    submission_id: int
    student_id: int
    file_path: str
    cleaned_text: Optional[str]
    code_cells: List[tuple[int, str]]
    similarity_flag: Optional[SimilarityFlag]
    grade_request: Optional[Dict[str, Any]]
    grade_result: Optional[GradeResult]
    error: Optional[str]


class PipelineState(TypedDict, total=False):
    assignment_id: int
    model: str
    assignment_title: str
    assignment_description: str
    rubric_text: str
    max_marks: float
    submissions: List[SubmissionItem]
    batch_id: Optional[str]
    batch_status: Optional[str]
    raw_batch_results: List[Any]
    errors: List[str]
    completed: bool
    poll_interval_seconds: float
    max_poll_seconds: float
    direct_execution: bool
    # Internal runtime clients / sessions (not serialized)
    client: Optional[Any]
    db_session: Optional[AsyncSession]


# ── Node 1: Preprocess Node ──────────────────────────────────────────────────

async def preprocess_node(state: PipelineState) -> Dict[str, Any]:
    """
    1. Loads the assignment from PostgreSQL.
    2. Loads all pending/processing submissions for this assignment.
    3. Marks their status as 'processing' in the database.
    4. For each submission, reads and cleans the .ipynb file using notebook_processing.
    5. Extracts cleaned text and code cells for subsequent nodes.
    """
    assignment_id = state["assignment_id"]
    errors: List[str] = list(state.get("errors", []))
    session: Optional[AsyncSession] = state.get("db_session")
    owns_session = False

    if session is None:
        session = AsyncSessionLocal()
        owns_session = True

    try:
        # Load assignment
        stmt = select(Assignment).where(Assignment.id == assignment_id)
        res = await session.execute(stmt)
        assignment = res.scalar_one_or_none()

        if not assignment:
            msg = f"Assignment id={assignment_id} not found."
            logger.error(msg)
            return {
                "errors": errors + [msg],
                "submissions": [],
                "completed": False,
            }

        # Load submissions (pending or currently processing)
        sub_stmt = select(Submission).where(
            Submission.assignment_id == assignment_id,
            Submission.status.in_([SubmissionStatus.pending, SubmissionStatus.processing]),
        )
        sub_res = await session.execute(sub_stmt)
        db_submissions = sub_res.scalars().all()

        logger.info(
            "Found %d pending/processing submission(s) for assignment id=%d",
            len(db_submissions), assignment_id
        )

        submissions_data: List[SubmissionItem] = []

        for sub in db_submissions:
            # Update status to processing in DB
            sub.status = SubmissionStatus.processing

            item: SubmissionItem = {
                "submission_id": sub.id,
                "student_id": sub.student_id,
                "file_path": sub.file_path,
                "cleaned_text": None,
                "code_cells": [],
                "similarity_flag": None,
                "grade_request": None,
                "grade_result": None,
                "error": None,
            }

            path = Path(sub.file_path)
            if not path.exists():
                err_msg = f"Notebook file not found at path: {sub.file_path}"
                logger.warning(err_msg)
                item["error"] = err_msg
            else:
                try:
                    nb_result = process_notebook(path)
                    item["cleaned_text"] = nb_result.text
                    item["code_cells"] = [
                        (c.index, c.source)
                        for c in nb_result.processed_cells
                        if c.cell_type == "code"
                    ]
                except Exception as exc:
                    err_msg = f"Failed to preprocess notebook {path.name}: {exc}"
                    logger.warning(err_msg)
                    item["error"] = err_msg

            submissions_data.append(item)

        await session.commit()

        return {
            "assignment_title": assignment.title,
            "assignment_description": assignment.description,
            "rubric_text": assignment.rubric_text,
            "max_marks": assignment.max_marks,
            "submissions": submissions_data,
            "errors": errors,
        }

    except Exception as exc:
        logger.exception("Error in preprocess_node: %s", exc)
        if session:
            await session.rollback()
        return {
            "errors": errors + [f"preprocess_node failed: {exc}"],
            "submissions": [],
            "completed": False,
        }
    finally:
        if owns_session and session:
            await session.close()


# ── Node 2: Similarity Check Node ────────────────────────────────────────────

async def similarity_check_node(state: PipelineState) -> Dict[str, Any]:
    """
    Runs similarity detection once across ALL submissions for this assignment.
    Attaches similarity flags to the corresponding submissions.
    """
    submissions = state.get("submissions", [])
    if not submissions:
        return {"submissions": []}

    # Extract submissions that have valid code cells
    valid_subs = [
        SubmissionText(
            student_id=sub["student_id"],
            submission_id=sub["submission_id"],
            code_cells=sub.get("code_cells", []),
        )
        for sub in submissions
        if sub.get("cleaned_text") and not sub.get("error") and sub.get("code_cells")
    ]

    # Need at least 2 submissions to compare
    if len(valid_subs) < 2:
        logger.info("Fewer than 2 submissions with valid code cells. Skipping similarity check.")
        return {"submissions": submissions}

    logger.info("Running similarity detection across %d submissions...", len(valid_subs))
    flags = find_similar_pairs(valid_subs, threshold=0.75)
    logger.info("Similarity check found %d flagged pair(s)", len(flags))

    # Map flags to submissions (if a submission is involved in multiple flags, keep the highest score)
    flag_map: Dict[int, SimilarityFlag] = {}
    for flag in flags:
        for sub_id in (flag.submission_id_a, flag.submission_id_b):
            if sub_id not in flag_map or flag.overall_score > flag_map[sub_id].overall_score:
                flag_map[sub_id] = flag

    updated_subs: List[SubmissionItem] = []
    for sub in submissions:
        sid = sub["submission_id"]
        if sid in flag_map:
            sub["similarity_flag"] = flag_map[sid]
            logger.info("Submission id=%d flagged for similarity: %s", sid, flag_map[sid].explanation)
        updated_subs.append(sub)

    return {"submissions": updated_subs}


# ── Node 3: Build Grading Requests Node ──────────────────────────────────────

async def build_grading_requests_node(state: PipelineState) -> Dict[str, Any]:
    """
    Builds the tool-use request payloads for Anthropic's Message Batches API.
    One request per submission with cleaned_text and no error.
    """
    submissions = state.get("submissions", [])
    if not submissions:
        return {"submissions": []}

    model = state.get("model", "claude-sonnet-4-5")
    task_desc = state.get("assignment_description", "")
    rubric = state.get("rubric_text", "")
    max_marks = state.get("max_marks", 100.0)

    system_prompt = _build_system_prompt()

    updated_subs: List[SubmissionItem] = []
    for sub in submissions:
        if sub.get("error") or not sub.get("cleaned_text"):
            updated_subs.append(sub)
            continue

        user_prompt = _build_user_prompt(
            task_description=task_desc,
            rubric=rubric,
            notebook_text=sub["cleaned_text"],
            max_marks=max_marks,
            similarity_flag=sub.get("similarity_flag"),
        )

        request_payload = {
            "custom_id": str(sub["submission_id"]),
            "params": {
                "model": model,
                "max_tokens": 1024,
                "system": system_prompt,
                "tools": [_GRADE_TOOL],
                "tool_choice": {"type": "any"},
                "messages": [{"role": "user", "content": user_prompt}],
            },
        }

        sub["grade_request"] = request_payload
        updated_subs.append(sub)

    valid_requests = [s["grade_request"] for s in updated_subs if s.get("grade_request")]
    logger.info("Built %d grading request(s) for the batch.", len(valid_requests))

    return {"submissions": updated_subs}


# ── Node 4: Submit Batch Node ────────────────────────────────────────────────

async def submit_batch_node(state: PipelineState) -> Dict[str, Any]:
    """
    Submits all prepared grading requests as a single batch to the Anthropic Message Batches API.
    If direct_execution=True (e.g. for testing/instant grading), performs direct calls instead.
    """
    submissions = state.get("submissions", [])
    requests = [s["grade_request"] for s in submissions if s.get("grade_request")]

    if not requests:
        logger.info("No requests to submit in batch.")
        return {"batch_id": None, "batch_status": "empty"}

    # Check if using Google Gemini (Free) or Claude
    provider = state.get("provider")
    if not provider:
        if state.get("client") is not None:
            provider = "anthropic"
        elif settings.GEMINI_API_KEY and not settings.ANTHROPIC_API_KEY:
            provider = "gemini"
        elif settings.ANTHROPIC_API_KEY and not settings.GEMINI_API_KEY:
            provider = "anthropic"
        else:
            provider = (settings.LLM_PROVIDER or "gemini").lower()

    if provider == "gemini":
        logger.info("Executing batch grading via Google Gemini for %d submissions...", len(submissions))
        raw_results = []
        gemini_model = state.get("model") or settings.GEMINI_MODEL
        rubric = state.get("rubric_text", "")
        task_desc = state.get("assignment_description", "")
        max_marks = state.get("max_marks", 100.0)

        for i, sub in enumerate(submissions):
            if sub.get("error") or not sub.get("cleaned_text"):
                continue

            sid = sub["submission_id"]
            logger.info("Gemini grading submission %d/%d (id=%d)...", i + 1, len(submissions), sid)

            # Pacing for Gemini Free Tier (15 RPM)
            if i > 0:
                await asyncio.sleep(4.1)

            try:
                res = grade_with_gemini(
                    rubric=rubric,
                    task_description=task_desc,
                    notebook_text=sub["cleaned_text"],
                    similarity_flag=sub.get("similarity_flag"),
                    max_marks=max_marks,
                    model=gemini_model,
                )
                raw_results.append({
                    "custom_id": str(sid),
                    "result": {
                        "type": "succeeded",
                        "grade_result": res,
                    }
                })
            except Exception as exc:
                logger.error("Gemini grading error for submission %d: %s", sid, exc)
                raw_results.append({
                    "custom_id": str(sid),
                    "result": {
                        "type": "errored",
                        "error": str(exc),
                    }
                })

        return {
            "batch_id": "gemini_batch",
            "batch_status": "ended",
            "raw_batch_results": raw_results,
        }

    client = state.get("client")
    if client is None:
        key = settings.ANTHROPIC_API_KEY
        if not key:
            raise GradingError("ANTHROPIC_API_KEY is not set.")
        client = anthropic.Anthropic(api_key=key)

    direct_exec = state.get("direct_execution", False)

    if direct_exec:
        logger.info("Direct execution requested: executing %d requests directly.", len(requests))
        raw_results = []
        for req in requests:
            custom_id = req["custom_id"]
            params = req["params"]
            try:
                response = client.messages.create(**params)
                raw_results.append({
                    "custom_id": custom_id,
                    "result": {
                        "type": "succeeded",
                        "message": response,
                    },
                })
            except Exception as exc:
                raw_results.append({
                    "custom_id": custom_id,
                    "result": {
                        "type": "errored",
                        "error": str(exc),
                    },
                })
        return {
            "batch_id": "direct_batch",
            "batch_status": "ended",
            "raw_batch_results": raw_results,
        }

    # Submit to Anthropic Message Batches API
    logger.info("Submitting batch of %d requests to Anthropic Message Batches API...", len(requests))
    try:
        batch = client.messages.batches.create(requests=requests)
        logger.info("Batch created successfully: id=%s status=%s", batch.id, batch.processing_status)
        return {
            "batch_id": batch.id,
            "batch_status": batch.processing_status,
        }
    except Exception as exc:
        logger.exception("Failed to submit message batch: %s", exc)
        return {
            "errors": list(state.get("errors", [])) + [f"Batch submission failed: {exc}"],
            "batch_id": None,
            "batch_status": "failed",
        }


# ── Node 5: Poll Batch Node ──────────────────────────────────────────────────

async def poll_batch_node(state: PipelineState) -> Dict[str, Any]:
    """
    Polls the batch job until it has finished processing (status == 'ended'),
    or until max_poll_seconds timeout is exceeded.
    Fetches the raw results once ended.
    """
    batch_id = state.get("batch_id")
    if not batch_id or batch_id in ("direct_batch", "gemini_batch"):
        return {}

    client = state.get("client")
    if client is None:
        key = settings.ANTHROPIC_API_KEY
        client = anthropic.Anthropic(api_key=key)

    poll_interval = state.get("poll_interval_seconds", 2.0)
    max_poll = state.get("max_poll_seconds", 300.0)
    elapsed = 0.0

    logger.info("Polling batch id=%s (poll_interval=%.1fs, max_wait=%.1fs)...", batch_id, poll_interval, max_poll)

    status = state.get("batch_status", "in_progress")
    while status not in ("ended", "failed", "canceled", "expired"):
        if elapsed >= max_poll:
            logger.error("Polling timed out after %.1fs for batch id=%s", elapsed, batch_id)
            return {
                "batch_status": "timeout",
                "errors": list(state.get("errors", [])) + [f"Batch {batch_id} polling timed out."],
                "raw_batch_results": [],
            }

        await asyncio.sleep(poll_interval)
        elapsed += poll_interval

        try:
            batch = client.messages.batches.retrieve(batch_id)
            status = batch.processing_status
            logger.info("Batch id=%s status=%s (elapsed: %.1fs)", batch_id, status, elapsed)
        except Exception as exc:
            logger.warning("Error while polling batch %s: %s", batch_id, exc)

    if status != "ended":
        logger.error("Batch %s terminated with unexpected status: %s", batch_id, status)
        return {
            "batch_status": status,
            "errors": list(state.get("errors", [])) + [f"Batch ended with status: {status}"],
            "raw_batch_results": [],
        }

    # Retrieve all results
    logger.info("Batch %s completed! Fetching results...", batch_id)
    raw_results = []
    try:
        for item in client.messages.batches.results(batch_id):
            raw_results.append(item)
    except Exception as exc:
        logger.exception("Failed to retrieve batch results: %s", exc)
        return {
            "errors": list(state.get("errors", [])) + [f"Failed to retrieve batch results: {exc}"],
            "raw_batch_results": [],
        }

    return {
        "batch_status": status,
        "raw_batch_results": raw_results,
    }


# ── Node 6: Parse Results Node ───────────────────────────────────────────────

async def parse_results_node(state: PipelineState) -> Dict[str, Any]:
    """
    Parses the batch results into structured GradeResult objects.
    Handles per-submission errors cleanly without failing the rest of the batch.
    """
    submissions = state.get("submissions", [])
    raw_results = state.get("raw_batch_results", [])
    max_marks = state.get("max_marks", 100.0)
    model = state.get("model", "claude-sonnet-4-5")

    # Index results by custom_id
    results_by_id: Dict[str, Any] = {}
    for res in raw_results:
        cid = getattr(res, "custom_id", None) or (res.get("custom_id") if isinstance(res, dict) else None)
        if cid:
            results_by_id[str(cid)] = res

    updated_subs: List[SubmissionItem] = []

    for sub in submissions:
        # If this submission already encountered an error earlier, retain it
        if sub.get("error"):
            updated_subs.append(sub)
            continue

        sid_str = str(sub["submission_id"])
        item_res = results_by_id.get(sid_str)

        if not item_res:
            sub["error"] = f"No result returned by batch for submission id={sid_str}"
            updated_subs.append(sub)
            continue

        # Extract result type and payload
        res_obj = getattr(item_res, "result", None) or (item_res.get("result") if isinstance(item_res, dict) else None)
        res_type = getattr(res_obj, "type", None) or (res_obj.get("type") if isinstance(res_obj, dict) else None)

        if res_type == "succeeded":
            if isinstance(res_obj, dict) and "grade_result" in res_obj:
                sub["grade_result"] = res_obj["grade_result"]
            else:
                message = getattr(res_obj, "message", None) or (res_obj.get("message") if isinstance(res_obj, dict) else None)
                try:
                    tool_input = _extract_tool_input(message)
                    usage = getattr(message, "usage", None) or (message.get("usage") if isinstance(message, dict) else None)
                    grade_res = _parse_grade_result(
                        tool_input=tool_input,
                        max_marks=max_marks,
                        model=model,
                        usage=usage,
                        similarity_flag=sub.get("similarity_flag"),
                    )
                    sub["grade_result"] = grade_res
                except Exception as exc:
                    err_msg = f"Failed to parse tool output for submission id={sid_str}: {exc}"
                    logger.warning(err_msg)
                    sub["error"] = err_msg

        elif res_type == "errored":
            error_val = getattr(res_obj, "error", None) or (res_obj.get("error") if isinstance(res_obj, dict) else None)
            err_msg = f"Batch request error for submission id={sid_str}: {error_val}"
            logger.warning(err_msg)
            sub["error"] = err_msg

        else:
            err_msg = f"Unexpected batch result type '{res_type}' for submission id={sid_str}"
            logger.warning(err_msg)
            sub["error"] = err_msg

        updated_subs.append(sub)

    return {"submissions": updated_subs}


# ── Node 7: Persist Results Node ─────────────────────────────────────────────

async def persist_results_node(state: PipelineState) -> Dict[str, Any]:
    """
    Persists grades to the `grades` table in PostgreSQL.
    Updates submission status to 'graded', 'flagged', or 'error'.
    """
    submissions = state.get("submissions", [])
    session: Optional[AsyncSession] = state.get("db_session")
    owns_session = False

    if session is None:
        session = AsyncSessionLocal()
        owns_session = True

    try:
        for sub in submissions:
            sub_id = sub["submission_id"]
            db_sub = await session.get(Submission, sub_id)
            if not db_sub:
                logger.warning("Submission id=%d not found in DB during persist.", sub_id)
                continue

            grade_result: Optional[GradeResult] = sub.get("grade_result")

            if grade_result:
                # Check if a grade record already exists for this submission
                existing_grade_stmt = select(Grade).where(Grade.submission_id == sub_id)
                existing_grade_res = await session.execute(existing_grade_stmt)
                grade_row = existing_grade_res.scalar_one_or_none()

                if not grade_row:
                    grade_row = Grade(
                        submission_id=sub_id,
                        marks=grade_result.marks,
                        max_marks=grade_result.max_marks,
                        reasoning_text=grade_result.reasoning,
                        flagged=grade_result.flagged,
                        flag_reason=grade_result.flag_reason,
                        graded_at=datetime.now(timezone.utc),
                    )
                    session.add(grade_row)
                else:
                    grade_row.marks = grade_result.marks
                    grade_row.max_marks = grade_result.max_marks
                    grade_row.reasoning_text = grade_result.reasoning
                    grade_row.flagged = grade_result.flagged
                    grade_row.flag_reason = grade_result.flag_reason
                    grade_row.graded_at = datetime.now(timezone.utc)

                # Set submission status based on flag
                if grade_result.flagged:
                    db_sub.status = SubmissionStatus.flagged
                else:
                    db_sub.status = SubmissionStatus.graded

            elif sub.get("error"):
                db_sub.status = SubmissionStatus.error

        await session.commit()
        logger.info("Successfully persisted results for %d submission(s).", len(submissions))
        return {"completed": True}

    except Exception as exc:
        logger.exception("Error in persist_results_node: %s", exc)
        if session:
            await session.rollback()
        return {
            "errors": list(state.get("errors", [])) + [f"persist_results_node failed: {exc}"],
            "completed": False,
        }
    finally:
        if owns_session and session:
            await session.close()


# ── LangGraph Compilation ────────────────────────────────────────────────────

def create_grading_graph():
    """Builds and compiles the 7-node LangGraph grading workflow."""
    workflow = StateGraph(PipelineState)

    # Register nodes
    workflow.add_node("preprocess_node", preprocess_node)
    workflow.add_node("similarity_check_node", similarity_check_node)
    workflow.add_node("build_grading_requests_node", build_grading_requests_node)
    workflow.add_node("submit_batch_node", submit_batch_node)
    workflow.add_node("poll_batch_node", poll_batch_node)
    workflow.add_node("parse_results_node", parse_results_node)
    workflow.add_node("persist_results_node", persist_results_node)

    # Define linear execution flow
    workflow.set_entry_point("preprocess_node")
    workflow.add_edge("preprocess_node", "similarity_check_node")
    workflow.add_edge("similarity_check_node", "build_grading_requests_node")
    workflow.add_edge("build_grading_requests_node", "submit_batch_node")
    workflow.add_edge("submit_batch_node", "poll_batch_node")
    workflow.add_edge("poll_batch_node", "parse_results_node")
    workflow.add_edge("parse_results_node", "persist_results_node")
    workflow.add_edge("persist_results_node", END)

    return workflow.compile()


grading_graph = create_grading_graph()


# ── Public API Entry Point ───────────────────────────────────────────────────

async def run_grading_pipeline(
    assignment_id: int,
    client: Optional[Any] = None,
    model: str = "claude-sonnet-4-5",
    poll_interval_seconds: float = 2.0,
    max_poll_seconds: float = 300.0,
    direct_execution: bool = False,
    db_session: Optional[AsyncSession] = None,
) -> Dict[str, Any]:
    """
    Single entry point function to run the full grading pipeline for an assignment.

    Args:
        assignment_id:         The database ID of the assignment to grade.
        client:                Optional Anthropic client or mock client for testing.
        model:                 Claude model to use (default: claude-sonnet-4-5).
        poll_interval_seconds: How often to poll the batch status (seconds).
        max_poll_seconds:      Maximum time to wait before timing out (seconds).
        direct_execution:      If True, executes requests directly without Message Batches API.
        db_session:            Optional active AsyncSession to use.

    Returns:
        Final pipeline state dictionary containing submissions, grades, flags, and status.
    """
    initial_state: PipelineState = {
        "assignment_id": assignment_id,
        "model": model,
        "poll_interval_seconds": poll_interval_seconds,
        "max_poll_seconds": max_poll_seconds,
        "direct_execution": direct_execution,
        "client": client,
        "db_session": db_session,
        "submissions": [],
        "errors": [],
        "completed": False,
    }

    logger.info("Starting grading pipeline for assignment id=%d", assignment_id)
    final_state = await grading_graph.ainvoke(initial_state)
    logger.info("Completed grading pipeline for assignment id=%d (completed=%s)", assignment_id, final_state.get("completed"))
    return final_state


def run_grading_pipeline_sync(*args, **kwargs) -> Dict[str, Any]:
    """Synchronous wrapper for run_grading_pipeline."""
    return asyncio.run(run_grading_pipeline(*args, **kwargs))
