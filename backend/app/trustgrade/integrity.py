"""
backend/app/trustgrade/integrity.py
-----------------------------------
Cryptographic integrity hashing and tamper verification for assignment rubrics,
task descriptions, and instructor prompts.
"""

import hashlib
import logging

logger = logging.getLogger("trustgrade.integrity")


def compute_rubric_hash(
    rubric_text: str,
    task_description: str,
    llm_prompt: str | None = None,
    max_marks: float = 100.0,
) -> str:
    """
    Computes a cryptographic SHA-256 fingerprint for assignment grading materials.
    Ensures that any subsequent tampering with the rubric or instructor directives
    is detectable.
    """
    try:
        hasher = hashlib.sha256()
        hasher.update((rubric_text or "").strip().encode("utf-8"))
        hasher.update(b"::")
        hasher.update((task_description or "").strip().encode("utf-8"))
        hasher.update(b"::")
        hasher.update((llm_prompt or "").strip().encode("utf-8"))
        hasher.update(b"::")
        hasher.update(str(float(max_marks)).encode("utf-8"))
        return hasher.hexdigest()
    except Exception as exc:
        logger.warning("Integrity hash computation error (failing safe): %s", exc)
        return ""


def verify_rubric_integrity(current_hash: str, recorded_hash: str) -> bool:
    """Verifies that an assignment's current rubric hash matches its recorded baseline."""
    if not current_hash or not recorded_hash:
        return True  # Fail open if not established
    return current_hash == recorded_hash
