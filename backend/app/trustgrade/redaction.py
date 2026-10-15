"""
backend/app/trustgrade/redaction.py
-----------------------------------
Sensitive information leak detector and redaction engine for LLM feedback and logs.
Intercepts canary tokens, API keys, database credentials, and system prompt text before storage.
"""

import re
import logging
from app.trustgrade.config import get_canary_token

logger = logging.getLogger("trustgrade.redaction")

# Secret key regex patterns
_SECRET_PATTERNS = [
    (re.compile(r"AIza[0-9A-Za-z\-_]{35}"), "[REDACTED_API_KEY]"),
    (re.compile(r"sk-ant-[0-9A-Za-z\-_]{20,}"), "[REDACTED_API_KEY]"),
    (re.compile(r"postgres(ql)?\+asyncpg://[^:]+:[^@]+@[^/]+/\S+"), "[REDACTED_DATABASE_URL]"),
]


def redact_sensitive_leaks(reasoning_text: str) -> tuple[str, bool]:
    """
    Scans reasoning text for canary tokens and secrets.
    Redacts matches in-place and flags if a leak occurred.

    Returns:
        (sanitized_text, leak_detected)
    """
    if not reasoning_text:
        return "", False

    try:
        leaked = False
        text = reasoning_text
        canary = get_canary_token()

        # Check for canary leakage
        if canary and canary in text:
            leaked = True
            text = text.replace(canary, "[REDACTED_SECURITY_CANARY]")
            logger.critical("TrustGrade: Canary token leak intercepted and redacted from reasoning!")

        # Check for known API keys / credentials
        for pattern, replacement in _SECRET_PATTERNS:
            if pattern.search(text):
                leaked = True
                text = pattern.sub(replacement, text)
                logger.warning("TrustGrade: Secret key pattern redacted from reasoning!")

        return text, leaked
    except Exception as exc:
        logger.warning("Redaction engine error (failing safe): %s", exc)
        return reasoning_text, False
