"""
grading.py
----------
Grades ONE student's preprocessed notebook using the Anthropic Claude API.

Main entry point:
    grade_submission(
        rubric: str,
        task_description: str,
        notebook_text: str,
        similarity_flag: SimilarityFlag | None = None,
        max_marks: float = 100.0,
        model: str = "claude-sonnet-4-5",
    ) -> GradeResult

Design notes
------------
- Uses Anthropic's **tool use** feature to guarantee structured JSON output.
  The model is forced to call a `submit_grade` tool whose schema matches
  GradeResult exactly — no string parsing, no regex, no hallucinated keys.
- The similarity flag (from Phase 3) is passed as context in the prompt.
  The model does NOT detect plagiarism itself — it only incorporates a
  pre-computed flag into the flagged/flag_reason fields.
- All errors are re-raised as typed exceptions (GradingError subclasses)
  so the pipeline can handle them cleanly per-submission.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any

import anthropic
from pydantic import BaseModel, Field

from app.config import get_settings
from app.similarity import SimilarityFlag

logger = logging.getLogger(__name__)

settings = get_settings()


# ── Gemini Schema ─────────────────────────────────────────────────────────────

class GeminiGradeSchema(BaseModel):
    marks: float = Field(
        description="Total numeric marks awarded to the student according to the rubric breakdown."
    )
    max_marks: float = Field(
        description="Maximum achievable marks for this assignment."
    )
    reasoning: str = Field(
        description="Detailed, objective critique explaining how the student performed against each rubric criterion."
    )
    flagged: bool = Field(
        description="Set to true if a similarity flag was provided in the prompt or plagiarism is suspected; otherwise false."
    )
    flag_reason: str | None = Field(
        default=None,
        description="Explanation of why this submission was flagged, or null if flagged is false."
    )


# ── Typed exceptions ──────────────────────────────────────────────────────────

class GradingError(Exception):
    """Base class for all grading errors."""


class GradingAPIError(GradingError):
    """Raised when the Anthropic API returns an error or is unreachable."""


class GradingParseError(GradingError):
    """Raised when the API response cannot be parsed into a GradeResult."""


class GradingTimeoutError(GradingError):
    """Raised when the API call times out."""


# ── Result type ───────────────────────────────────────────────────────────────

@dataclass
class GradeResult:
    """
    The structured grading output returned by the LLM.
    Maps directly to the `grades` DB table (Phase 1 schema).
    """
    marks: float
    max_marks: float
    reasoning: str                  # LLM explanation of the grade
    flagged: bool                   # True if similarity flag was passed in
    flag_reason: str | None         # Human-readable flag explanation

    # Metadata (not stored in DB, useful for debugging)
    model: str = ""
    input_tokens: int = 0
    output_tokens: int = 0

    @property
    def percentage(self) -> float:
        if self.max_marks == 0:
            return 0.0
        return round(self.marks / self.max_marks * 100, 1)


# ── Tool schema for structured output ────────────────────────────────────────

_GRADE_TOOL: dict[str, Any] = {
    "name": "submit_grade",
    "description": (
        "Submit the final grade for a student's notebook submission. "
        "You MUST call this tool with your grading decision."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "marks": {
                "type": "number",
                "description": (
                    "Marks awarded (0 to max_marks). Use a precise value "
                    "that reflects the rubric breakdown."
                ),
            },
            "max_marks": {
                "type": "number",
                "description": "Maximum possible marks for this assignment.",
            },
            "reasoning": {
                "type": "string",
                "description": (
                    "Detailed explanation of the grade. Reference specific "
                    "rubric criteria and what the student did well or poorly. "
                    "Be constructive and specific (3-8 sentences)."
                ),
            },
            "flagged": {
                "type": "boolean",
                "description": (
                    "Set to true ONLY if a similarity flag was provided in "
                    "the context. Do not flag submissions based on your own "
                    "judgment — only incorporate pre-computed flags."
                ),
            },
            "flag_reason": {
                "type": ["string", "null"],
                "description": (
                    "If flagged is true, copy the flag reason from context. "
                    "Otherwise null."
                ),
            },
        },
        "required": ["marks", "max_marks", "reasoning", "flagged", "flag_reason"],
    },
}


# ── Prompt construction ───────────────────────────────────────────────────────

def _build_system_prompt() -> str:
    return (
        "You are an expert, concise computer science teaching assistant grading student Jupyter notebooks.\n"
        "Your evaluation must be objective, fair, and direct based solely on the provided rubric.\n\n"
        "CRITICAL RULES:\n"
        "1. KEEP REASONING CONCISE: Provide at most 2 to 3 short sentences or concise bullet points total explaining marks awarded. Do NOT write long or repetitive essays.\n"
        "2. COPY / SIMILARITY CASES: If a similarity flag is provided indicating a copy case between students, flag=true, and you MUST explicitly state in the reasoning: 'Flagged for copy case: [X]% code match with student [Student ID] ([Student Email])'. Award 0 marks for copy cases.\n"
        "3. Output strict JSON matching the submit_grade schema."
    )


def _build_user_prompt(
    task_description: str,
    rubric: str,
    notebook_text: str,
    max_marks: float,
    similarity_flag: SimilarityFlag | None,
) -> str:
    parts: list[str] = []

    parts.append("## Assignment Task Description\n" + task_description.strip())
    parts.append(f"## Grading Rubric (Total: {max_marks} marks)\n" + rubric.strip())

    if similarity_flag:
        parts.append(
            "## ⚠️ PLAGIARISM / COPY CASE DETECTED (Pre-computed AST & Token Match)\n"
            f"- Details: {similarity_flag.explanation}\n"
            f"- Similarity Score: {round(similarity_flag.overall_score * 100, 1)}%\n"
            "- Instruction: You MUST set flagged=true, copy the explanation to flag_reason, and explicitly state in your concise reasoning the matched student's ID and Email."
        )
    else:
        parts.append(
            "## Similarity Check\n"
            "No similarity flag detected. Set flagged=false."
        )

    parts.append("## Student Notebook Submission\n" + notebook_text.strip())
    parts.append(
        "## Grading Action\n"
        "Evaluate the submission and call submit_grade with marks, max_marks, concise reasoning (2-3 sentences max), and flag status."
    )

    return "\n\n---\n\n".join(parts)


# ── Core grading function ─────────────────────────────────────────────────────

def grade_with_gemini(
    rubric: str,
    task_description: str,
    notebook_text: str,
    similarity_flag: SimilarityFlag | None = None,
    max_marks: float = 100.0,
    model: str = "gemini-2.0-flash",
    api_key: str | None = None,
) -> GradeResult:
    """
    Grade a single student's preprocessed notebook using Google Gemini's Free API.
    Guarantees structured JSON output matching GeminiGradeSchema.
    """
    from google import genai
    from google.genai import types

    key = api_key or settings.GEMINI_API_KEY
    if not key or key.startswith("your-"):
        raise GradingAPIError(
            "GEMINI_API_KEY is not set. Get a free API key at https://aistudio.google.com and add it to .env"
        )

    system_prompt = _build_system_prompt()
    user_prompt = _build_user_prompt(
        task_description=task_description,
        rubric=rubric,
        notebook_text=notebook_text,
        max_marks=max_marks,
        similarity_flag=similarity_flag,
    )

    logger.info(
        "Calling Gemini (%s) to grade submission (flag=%s, max_marks=%s)",
        model, similarity_flag is not None, max_marks,
    )

    import time
    models_to_try = [model]
    for alt in [
        "gemini-flash-latest",
        "gemini-3.5-flash-lite",
        "gemini-3.7-flash",
        "gemini-3.8-flash",
        "gemini-3.6-flash",
        "gemini-3.5-flash",
        "gemini-2.5-flash",
    ]:
        if alt not in models_to_try:
            models_to_try.append(alt)

    response = None
    last_err = None
    client = genai.Client(api_key=key)

    for m in models_to_try:
        try:
            response = client.models.generate_content(
                model=m,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    response_mime_type="application/json",
                    response_schema=GeminiGradeSchema,
                    temperature=0.2,
                ),
            )
            model = m
            break
        except Exception as exc:
            last_err = exc
            exc_str = str(exc)
            if "RESOURCE_EXHAUSTED" in exc_str or "429" in exc_str:
                logger.warning("Gemini model %s free quota exhausted, immediately trying next fallback candidate...", m)
            else:
                logger.warning("Gemini model %s failed: %s, trying next fallback candidate...", m, exc)

    if response is None:
        last_err_str = str(last_err)
        if "RESOURCE_EXHAUSTED" in last_err_str or "429" in last_err_str:
            raise GradingAPIError(
                "Daily free API quota exhausted across all AI models. "
                "Quota resets daily at 00:00 UTC (5:30 AM IST). "
                "You can also provide a fresh Gemini API key in your .env file."
            )
        raise GradingAPIError(f"All Gemini models failed: {last_err}")

    raw_text = getattr(response, "text", "") or ""
    if not raw_text.strip():
        raise GradingParseError("Gemini returned an empty response.")

    try:
        tool_input = json.loads(raw_text)
    except Exception as exc:
        raise GradingParseError(
            f"Failed to parse JSON response from Gemini: {exc}. Raw: {raw_text[:200]}"
        ) from exc

    usage = getattr(response, "usage_metadata", None)
    in_tok = getattr(usage, "prompt_token_count", 0) if usage else 0
    out_tok = getattr(usage, "candidates_token_count", 0) if usage else 0

    class DummyUsage:
        input_tokens = in_tok
        output_tokens = out_tok

    return _parse_grade_result(
        tool_input=tool_input,
        max_marks=max_marks,
        model=model,
        usage=DummyUsage(),
        similarity_flag=similarity_flag,
    )


def _grade_with_claude(
    rubric: str,
    task_description: str,
    notebook_text: str,
    similarity_flag: SimilarityFlag | None = None,
    max_marks: float = 100.0,
    model: str = "claude-sonnet-4-5",
    api_key: str | None = None,
) -> GradeResult:
    """
    Grade using Anthropic Claude with tool use.
    """
    key = api_key or settings.ANTHROPIC_API_KEY
    if not key or key.startswith("your-"):
        raise GradingAPIError(
            "ANTHROPIC_API_KEY is not set. Add it to your .env file."
        )

    client = anthropic.Anthropic(api_key=key)

    system_prompt = _build_system_prompt()
    user_prompt = _build_user_prompt(
        task_description=task_description,
        rubric=rubric,
        notebook_text=notebook_text,
        max_marks=max_marks,
        similarity_flag=similarity_flag,
    )

    logger.info(
        "Calling %s to grade submission (flag=%s, max_marks=%s)",
        model, similarity_flag is not None, max_marks,
    )

    try:
        response = client.messages.create(
            model=model,
            max_tokens=1024,
            system=system_prompt,
            tools=[_GRADE_TOOL],
            tool_choice={"type": "any"},   # forces the model to call a tool
            messages=[{"role": "user", "content": user_prompt}],
        )
    except anthropic.AuthenticationError as exc:
        raise GradingAPIError(f"Invalid API key: {exc}") from exc
    except anthropic.RateLimitError as exc:
        raise GradingAPIError(f"Rate limit exceeded: {exc}") from exc
    except anthropic.APITimeoutError as exc:
        raise GradingTimeoutError(f"API request timed out: {exc}") from exc
    except anthropic.APIError as exc:
        raise GradingAPIError(f"Anthropic API error: {exc}") from exc

    # Extract the tool call from the response
    tool_input = _extract_tool_input(response)

    # Validate and coerce the output
    result = _parse_grade_result(
        tool_input=tool_input,
        max_marks=max_marks,
        model=model,
        usage=response.usage,
        similarity_flag=similarity_flag,
    )

    logger.info(
        "Grade result: %s/%s (flagged=%s, tokens: in=%d out=%d)",
        result.marks, result.max_marks, result.flagged,
        result.input_tokens, result.output_tokens,
    )

    return result


def grade_submission(
    rubric: str,
    task_description: str,
    notebook_text: str,
    similarity_flag: SimilarityFlag | None = None,
    max_marks: float = 100.0,
    model: str | None = None,
    api_key: str | None = None,
    provider: str | None = None,
) -> GradeResult:
    """
    Main grading entry point supporting both Google Gemini (Free) and Anthropic Claude.
    Automatically picks provider based on configuration or available API keys.
    """
    chosen_provider = provider

    if not chosen_provider:
        if api_key:
            if api_key.startswith("AIza"):
                chosen_provider = "gemini"
            else:
                chosen_provider = "anthropic"
        elif settings.GEMINI_API_KEY and not settings.ANTHROPIC_API_KEY:
            chosen_provider = "gemini"
        elif settings.ANTHROPIC_API_KEY and not settings.GEMINI_API_KEY:
            chosen_provider = "anthropic"
        else:
            chosen_provider = (settings.LLM_PROVIDER or "gemini").lower()

    # Route to Gemini
    if chosen_provider == "gemini":
        m = model or settings.GEMINI_MODEL
        return grade_with_gemini(
            rubric=rubric,
            task_description=task_description,
            notebook_text=notebook_text,
            similarity_flag=similarity_flag,
            max_marks=max_marks,
            model=m,
            api_key=api_key,
        )

    # Route to Claude
    m = model or "claude-sonnet-4-5"
    return _grade_with_claude(
        rubric=rubric,
        task_description=task_description,
        notebook_text=notebook_text,
        similarity_flag=similarity_flag,
        max_marks=max_marks,
        model=m,
        api_key=api_key,
    )


# ── Response parsing helpers ──────────────────────────────────────────────────

def _extract_tool_input(response: anthropic.types.Message) -> dict[str, Any]:
    """
    Pull the submit_grade tool call input out of the API response.
    Raises GradingParseError if no tool call is found.
    """
    for block in response.content:
        if block.type == "tool_use" and block.name == "submit_grade":
            return block.input  # type: ignore[return-value]

    # Shouldn't happen with tool_choice="any", but handle defensively
    raw_text = " ".join(
        b.text for b in response.content if hasattr(b, "text")
    )
    raise GradingParseError(
        f"Model did not call submit_grade tool. "
        f"Response content: {raw_text[:300]}"
    )


def _parse_grade_result(
    tool_input: dict[str, Any],
    max_marks: float,
    model: str,
    usage: Any,
    similarity_flag: SimilarityFlag | None,
) -> GradeResult:
    """
    Validate and coerce the tool call input into a GradeResult.
    Raises GradingParseError on missing/invalid fields.
    """
    try:
        marks = float(tool_input["marks"])
        returned_max = float(tool_input.get("max_marks", max_marks))
        reasoning = str(tool_input["reasoning"]).strip()
        flagged = bool(tool_input["flagged"])
        flag_reason = tool_input.get("flag_reason")
        if flag_reason is not None:
            flag_reason = str(flag_reason).strip() or None
    except (KeyError, TypeError, ValueError) as exc:
        raise GradingParseError(
            f"Invalid tool call input from model: {exc}. Got: {tool_input}"
        ) from exc

    # Clamp marks to valid range
    marks = max(0.0, min(marks, max_marks))

    # Safety: if a flag was passed but the model forgot to set it, enforce it
    if similarity_flag and not flagged:
        logger.warning(
            "Model did not set flagged=true despite similarity flag. Enforcing."
        )
        flagged = True
        flag_reason = flag_reason or similarity_flag.explanation

    return GradeResult(
        marks=marks,
        max_marks=returned_max,
        reasoning=reasoning,
        flagged=flagged,
        flag_reason=flag_reason if flag_reason else None,
        model=model,
        input_tokens=getattr(usage, "input_tokens", 0),
        output_tokens=getattr(usage, "output_tokens", 0),
    )
