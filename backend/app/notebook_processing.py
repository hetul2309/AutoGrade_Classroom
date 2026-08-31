"""
notebook_processing.py
-----------------------
Converts a raw .ipynb file into a clean, token-efficient plain-text
representation suitable for sending to an LLM grader.

Main entry point:
    process_notebook(path: str) -> NotebookResult

The NotebookResult dataclass contains:
    - text          : the final cleaned text to send to the LLM
    - raw_tokens    : estimated token count BEFORE stripping
    - clean_tokens  : estimated token count AFTER stripping
    - cell_count    : number of cells processed
    - cells_dropped : number of cells fully dropped (e.g. empty)
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import nbformat

# ── Constants ─────────────────────────────────────────────────────────────────

# Output text longer than this gets truncated (per output item)
MAX_OUTPUT_CHARS = 500

# Cell source shorter than this (after strip) is considered "empty" and skipped
MIN_SOURCE_CHARS = 2

# MIME types we keep as text (everything else is dropped)
TEXT_MIME_TYPES = {
    "text/plain",
    "text/html",      # will be stripped of tags
    "application/json",
    "text/latex",
}

# MIME types we replace with a placeholder
BINARY_MIME_TYPES = {
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/svg+xml",
    "application/pdf",
    "video/mp4",
}

# Rough token estimate: ~4 chars per token (GPT-style approximation)
CHARS_PER_TOKEN = 4


# ── Dataclasses ───────────────────────────────────────────────────────────────

@dataclass
class ProcessedCell:
    index: int
    cell_type: str          # "code" or "markdown"
    source: str
    output: str = ""        # empty for markdown cells
    had_binary_output: bool = False


@dataclass
class NotebookResult:
    text: str
    raw_chars: int
    clean_chars: int
    raw_tokens: int
    clean_tokens: int
    cell_count: int
    cells_dropped: int
    processed_cells: list[ProcessedCell] = field(default_factory=list)

    @property
    def token_savings_pct(self) -> float:
        if self.raw_tokens == 0:
            return 0.0
        return round((1 - self.clean_tokens / self.raw_tokens) * 100, 1)


# ── Internal helpers ──────────────────────────────────────────────────────────

def _strip_html(text: str) -> str:
    """Remove HTML tags from text (e.g. rich text/html outputs)."""
    return re.sub(r"<[^>]+>", "", text).strip()


def _truncate(text: str, max_chars: int = MAX_OUTPUT_CHARS) -> tuple[str, bool]:
    """Return (possibly truncated text, was_truncated)."""
    if len(text) <= max_chars:
        return text, False
    return text[:max_chars] + f"\n... [truncated, {len(text) - max_chars} chars omitted]", True


def _process_output_item(output: dict[str, Any]) -> tuple[str, bool]:
    """
    Convert a single notebook output item to text.

    Returns:
        (text_representation, had_binary)
    """
    output_type = output.get("output_type", "")
    had_binary = False
    parts: list[str] = []

    # ── Stream output (print / stderr) ────────────────────────────────────
    if output_type == "stream":
        raw = "".join(output.get("text", []))
        text, _ = _truncate(raw)
        parts.append(text)

    # ── Error / traceback ─────────────────────────────────────────────────
    elif output_type == "error":
        ename = output.get("ename", "Error")
        evalue = output.get("evalue", "")
        # Include only the last 3 traceback lines to keep it short
        tb = output.get("traceback", [])
        # Strip ANSI colour codes
        clean_tb = [re.sub(r"\x1b\[[0-9;]*m", "", line) for line in tb[-3:]]
        tb_text = "\n".join(clean_tb)
        raw = f"{ename}: {evalue}\n{tb_text}"
        text, _ = _truncate(raw)
        parts.append(text)

    # ── execute_result / display_data (rich outputs) ───────────────────────
    elif output_type in ("execute_result", "display_data"):
        data = output.get("data", {})

        # Check for binary/image content first
        for mime in BINARY_MIME_TYPES:
            if mime in data:
                had_binary = True

        # Extract text content in priority order
        for mime in ("text/plain", "text/html", "application/json", "text/latex"):
            if mime not in data:
                continue
            raw_value = data[mime]
            if isinstance(raw_value, list):
                raw_value = "".join(raw_value)
            if mime == "text/html":
                raw_value = _strip_html(raw_value)
            if raw_value.strip():
                text, _ = _truncate(raw_value)
                parts.append(text)
                break  # only take the best text representation

    text_out = "\n".join(parts).strip()
    return text_out, had_binary


def _process_outputs(outputs: list[dict]) -> tuple[str, bool]:
    """Process all outputs from a code cell."""
    if not outputs:
        return "", False

    collected: list[str] = []
    any_binary = False

    for item in outputs:
        text, had_binary = _process_output_item(item)
        if had_binary:
            any_binary = True
        if text:
            collected.append(text)

    combined = "\n".join(collected)
    if any_binary:
        placeholder = "[image/plot output omitted]"
        if collected:
            combined = combined + f"\n{placeholder}"
        else:
            combined = placeholder

    return combined.strip(), any_binary


def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // CHARS_PER_TOKEN)


def _format_cell(cell: ProcessedCell) -> str:
    """Render a ProcessedCell to the final string format."""
    header = f"### Cell {cell.index} [{cell.cell_type}] ###"
    lines = [header, cell.source]
    if cell.output:
        lines.append("--- output ---")
        lines.append(cell.output)
    lines.append("")  # blank line between cells
    return "\n".join(lines)


# ── Public API ────────────────────────────────────────────────────────────────

def process_notebook(path: str | Path) -> NotebookResult:
    """
    Parse a .ipynb file and return a clean, token-efficient text representation.

    Args:
        path: Absolute or relative path to the .ipynb file.

    Returns:
        NotebookResult with .text ready to send to an LLM.

    Raises:
        FileNotFoundError: if the file does not exist.
        nbformat.ValidationError: if the file is not a valid notebook.
        ValueError: if the file cannot be parsed.
    """
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Notebook not found: {path}")

    # Read raw bytes for before-stripping size estimate
    raw_content = path.read_text(encoding="utf-8")
    raw_chars = len(raw_content)

    # Parse notebook (normalise to version 4)
    try:
        nb = nbformat.read(str(path), as_version=4)
    except Exception as exc:
        raise ValueError(f"Failed to parse notebook {path.name}: {exc}") from exc

    processed_cells: list[ProcessedCell] = []
    cells_dropped = 0
    cell_index = 0

    for nb_cell in nb.cells:
        cell_type = nb_cell.get("cell_type", "unknown")

        # We only handle code and markdown
        if cell_type not in ("code", "markdown"):
            cells_dropped += 1
            continue

        source = nb_cell.get("source", "").strip()

        # Drop empty/trivial cells
        if len(source) < MIN_SOURCE_CHARS:
            cells_dropped += 1
            continue

        cell_index += 1
        output_text = ""
        had_binary = False

        if cell_type == "code":
            raw_outputs = nb_cell.get("outputs", [])
            output_text, had_binary = _process_outputs(raw_outputs)

        processed_cells.append(ProcessedCell(
            index=cell_index,
            cell_type=cell_type,
            source=source,
            output=output_text,
            had_binary_output=had_binary,
        ))

    # Build final text
    sections = [
        "=== NOTEBOOK SUBMISSION ===",
        f"Total cells: {cell_index}",
        "",
    ]
    for cell in processed_cells:
        sections.append(_format_cell(cell))

    clean_text = "\n".join(sections).strip()
    clean_chars = len(clean_text)

    return NotebookResult(
        text=clean_text,
        raw_chars=raw_chars,
        clean_chars=clean_chars,
        raw_tokens=_estimate_tokens(raw_content),
        clean_tokens=_estimate_tokens(clean_text),
        cell_count=cell_index,
        cells_dropped=cells_dropped,
        processed_cells=processed_cells,
    )


def process_notebook_text(path: str | Path) -> str:
    """
    Convenience wrapper — returns only the cleaned text string.
    Use this when calling from the grading pipeline.
    """
    return process_notebook(path).text


# ── CLI helper (for quick manual inspection) ──────────────────────────────────

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python notebook_processing.py <path_to_notebook.ipynb>")
        sys.exit(1)

    result = process_notebook(sys.argv[1])
    print(result.text)
    print("\n" + "=" * 60)
    print(f"Raw size  : {result.raw_chars:,} chars  (~{result.raw_tokens:,} tokens)")
    print(f"Clean size: {result.clean_chars:,} chars  (~{result.clean_tokens:,} tokens)")
    print(f"Savings   : {result.token_savings_pct}%")
    print(f"Cells     : {result.cell_count} processed, {result.cells_dropped} dropped")
