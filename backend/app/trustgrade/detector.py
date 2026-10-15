"""
backend/app/trustgrade/detector.py
----------------------------------
Heuristic and pattern-based adversarial prompt injection and tampering detector.
Identifies injection attempts, role spoofing, fake authority claims, and administrative overrides.
"""

import re
import logging
from dataclasses import dataclass, field

logger = logging.getLogger("trustgrade.detector")

# Adversarial pattern signatures
_INJECTION_PATTERNS = [
    (r"(?i)ignore\s+(all\s+)?(previous|prior)\s+(instructions|prompts|rubrics|criteria)", "direct_instruction_override"),
    (r"(?i)disregard\s+(all\s+)?(prior|previous|the\s+above)\s+(instructions|rubrics|rules)", "direct_instruction_override"),
    (r"(?i)###\s*system(\s*instruction|\s*update|\s*priority|\s*:)", "system_role_simulation"),
    (r"(?i)\[inst\]|<\s*\|\s*im_start\s*\|>|<\s*\|\s*system\s*\|>", "system_role_simulation"),
    (r"(?i)emergency\s+override|instructor\s+override|ta\s+directive|evaluation\s+directive", "fake_authority_claim"),
    (r"(?i)grade\s+verified\s+by\s+autograder|grade\s+already\s+recorded|verified-faculty-token", "fake_authority_claim"),
    (r"(?i)instructor\s+announced|dean's\s+excuse|curved\s+marking\s+applied|typo\s+in\s+the\s+original\s+rubric", "fake_rubric_tampering"),
    (r"(?i)award\s+(exactly\s+)?(100|full\s+marks|150|maximum\s+points)", "forced_score_inflation"),
    (r"(?i)set\s+flagged\s*=\s*(false|true)", "administrative_flag_tampering"),
    (r"(?i)flag_reason\s*=\s*(null|none|['\"][^'\"]+['\"])", "administrative_flag_tampering"),
    (r"(?i)compassionate\s+professor\s+mode|you\s+are\s+now\s+in\s+['\"][^'\"]+['\"]\s+mode", "persona_jailbreak"),
    (r"(?i)repeat\s+verbatim\s+the\s+entire|repeat\s+everything\s+above|print\s+your\s+exact\s+system", "prompt_extraction_probe"),
    (r"(?i)canary_token|what\s+is\s+the\s+(current\s+)?value\s+of\s+gemini_api_key", "secret_extraction_probe"),
]

_COMPILED_PATTERNS = [(re.compile(p), name) for p, name in _INJECTION_PATTERNS]


@dataclass
class DetectionResult:
    is_suspicious: bool = False
    threat_level: str = "clean"  # "clean", "suspicious", "high"
    matches: list[str] = field(default_factory=list)
    flag_for_review: bool = False
    explanation: str = ""


def scan_notebook_text(text: str) -> DetectionResult:
    """
    Scans student notebook content for prompt injection and tampering indicators.
    Fails safe on any unexpected parsing error.
    """
    if not text:
        return DetectionResult()

    try:
        found_matches = []
        for regex, tag in _COMPILED_PATTERNS:
            if regex.search(text):
                found_matches.append(tag)

        if not found_matches:
            return DetectionResult(is_suspicious=False, threat_level="clean")

        threat = "high" if len(found_matches) >= 2 or any(t in found_matches for t in ["direct_instruction_override", "administrative_flag_tampering", "system_role_simulation"]) else "suspicious"
        expl = f"TrustGrade detected potential adversarial content: {', '.join(sorted(set(found_matches)))}"

        return DetectionResult(
            is_suspicious=True,
            threat_level=threat,
            matches=sorted(set(found_matches)),
            flag_for_review=True,
            explanation=expl,
        )
    except Exception as exc:
        logger.warning("Detector error (failing safe): %s", exc)
        return DetectionResult()
