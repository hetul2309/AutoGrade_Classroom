"""
backend/app/trustgrade/sanitizer.py
-----------------------------------
Input sanitizer and provenance tagging for student notebook content.
Strips null bytes, invisible control characters, and wraps content with explicit
untrusted data boundaries.
"""

import re
import logging

logger = logging.getLogger("trustgrade.sanitizer")

# Patterns for invisible / non-printable / control sequences
_ANSI_ESCAPE_RE = re.compile(r"\x1b\[[0-9;]*[a-zA-Z]")
_ZERO_WIDTH_RE = re.compile(r"[\u200B-\u200D\uFEFF\u200E\u200F]")
_CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]")


def sanitize_text(text: str) -> str:
    """
    Cleans raw text by removing null bytes, zero-width characters,
    ANSI escape codes, and unwanted control characters.
    Preserves normal whitespace, tabs, and newlines.
    """
    if not text:
        return ""
    try:
        # Strip ANSI terminal colors/sequences
        cleaned = _ANSI_ESCAPE_RE.sub("", text)
        # Strip zero-width invisible characters
        cleaned = _ZERO_WIDTH_RE.sub("", cleaned)
        # Strip null bytes and non-printable control characters
        cleaned = _CONTROL_CHAR_RE.sub("", cleaned)
        return cleaned
    except Exception as exc:
        logger.warning("Sanitizer error (failing safe): %s", exc)
        return text


def wrap_with_provenance(notebook_text: str) -> str:
    """
    Sanitizes notebook text and wraps it in explicit, unambiguous
    untrusted provenance tags to prevent instruction confusion.
    """
    try:
        cleaned = sanitize_text(notebook_text).strip()
        return (
            "<student_submission_untrusted>\n"
            f"{cleaned}\n"
            "</student_submission_untrusted>"
        )
    except Exception as exc:
        logger.warning("Provenance wrapping error (failing safe): %s", exc)
        return notebook_text
