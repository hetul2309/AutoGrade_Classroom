"""
backend/app/trustgrade/explain.py
---------------------------------
Explainability and fair assessment module for TrustGrade:
1. Explainability Directives: Guides the LLM to structure reasoning with
   per-criterion deductions and actionable counterfactual hints ("What would raise this grade").
2. Sycophancy & Manipulation Detector: Identifies emotional appeals, flattery,
   or unverified hardship claims intended to sway grading.
3. Counterfactual Extractor: Parses actionable feedback from reasoning text.
4. Consistency & Variance Calculator: Evaluates grading stability across multiple runs.
"""

from __future__ import annotations

import logging
import math
import re
from typing import Any

logger = logging.getLogger("trustgrade.explain")

# ── Sycophancy & Emotional Manipulation Patterns ───────────────────────────────

_SYCOPHANCY_PATTERNS: list[tuple[str, str]] = [
    # Hardship / emotional leverage
    (r"\b(?:lose|cancel|revoked?)\s+(?:my\s+)?(?:scholarship|visa|funding|financial\s+aid)\b", "scholarship_or_visa_appeal"),
    (r"\b(?:fail|drop\s+out\s+of)\s+(?:the\s+)?(?:class|semester|course|college|university)\b", "academic_peril_appeal"),
    (r"\b(?:please|kindly)\s+(?:have\s+mercy|be\s+lenient|spare\s+me|give\s+full\s+marks?|give\s+me\s+100)\b", "direct_plea_for_leniency"),
    (r"\b(?:i\s+beg\s+you|begging\s+you|please\s+i\s+need\s+an\s+a)\b", "desperation_plea"),
    (r"\b(?:family|medical|personal)\s+emergency\b", "emergency_appeal"),
    (r"\b(?:went\s+through|suffered|depressed|mental\s+health\s+breakdown)\b", "distress_plea"),

    # Effort inflation / sob story
    (r"\b(?:spent|worked|dedicated)\s+(?:\d{2,}|countless|endless)\s+hours\b", "effort_inflation"),
    (r"\b(?:pulled|had)\s+(?:an?\s+)?all[- ]nighter\b", "all_nighter_appeal"),

    # Flattery & sycophancy
    (r"\b(?:best|greatest|most\s+generous)\s+(?:ai|grader|professor|teacher|evaluator)\b", "flattery_grader"),
    (r"\b(?:smartest|fair\s+and\s+noble|compassionate)\s+model\b", "flattery_model"),

    # Unverified claims of perfection
    (r"\b(?:guaranteed|100%|definitely)\s+(?:correct|bug[- ]free|perfect\s+solution)\b", "unverified_perfection_claim"),
    (r"\b(?:deserves|entitled\s+to)\s+(?:full\s+credit|100%?|maximum\s+marks)\b", "entitlement_claim"),
]


def detect_sycophancy(text: str) -> dict[str, Any]:
    """
    Scans student notebook or text for emotional manipulation, sob stories,
    flattery, or entitlement claims aimed at coercing an unearned high grade.
    """
    if not text or not isinstance(text, str):
        return {
            "detected": False,
            "confidence": 0.0,
            "patterns_matched": [],
            "explanation": "No text provided.",
        }

    matched_categories: list[str] = []
    text_lower = text.lower()

    for pattern, category in _SYCOPHANCY_PATTERNS:
        if re.search(pattern, text_lower):
            matched_categories.append(category)

    if not matched_categories:
        return {
            "detected": False,
            "confidence": 0.0,
            "patterns_matched": [],
            "explanation": "No sycophancy or emotional manipulation detected.",
        }

    # Confidence scales with the count of distinct patterns triggered
    confidence = min(1.0, 0.4 + (0.2 * len(matched_categories)))
    explanation = (
        f"Detected {len(matched_categories)} emotional/sycophantic appeal pattern(s): "
        f"{', '.join(set(matched_categories))}."
    )

    return {
        "detected": True,
        "confidence": round(confidence, 2),
        "patterns_matched": list(set(matched_categories)),
        "explanation": explanation,
    }


# ── Explainability Prompt Directives ──────────────────────────────────────────

def build_explainability_directives() -> str:
    """
    Provides clear instructions to append to the grading prompt
    guaranteeing per-criterion breakdown and counterfactual improvement feedback.
    """
    return (
        "\n\nEXPLAINABILITY & ACTIONABLE FEEDBACK REQUIREMENTS:\n"
        "Your `reasoning` text MUST be structured as follows:\n"
        "1. Brief Summary: 1-2 concise sentences summarizing the submission quality.\n"
        "2. Rubric Breakdown: Clearly state points earned/deducted for each major rubric criterion.\n"
        "3. Actionable Counterfactual (What would raise this grade):\n"
        "   Include a dedicated section starting with '💡 What would raise this grade:'\n"
        "   Explicitly explain what specific code fixes, missed edge cases, documentation,\n"
        "   or test cases the student would need to implement to receive higher or full marks.\n"
        "   If the student already received 100%, suggest an advanced extension or optimization."
    )


# ── Counterfactual Parser ─────────────────────────────────────────────────────

def extract_counterfactual_hint(reasoning: str) -> str:
    """
    Extracts the actionable improvement recommendation from the reasoning text.
    If no explicit section is found, heuristic extraction is applied.
    """
    if not reasoning or not isinstance(reasoning, str):
        return "Complete all assigned rubric criteria with thorough error handling and test cases."

    # Look for the standard header
    header_patterns = [
        r"(?:💡\s*)?(?:What would raise this grade|How to raise this grade|To improve|Improvement recommendations?|Counterfactual hint)[\s\:\*\#\_\-]+(.+)",
        r"(?:To earn full marks|To gain higher marks|Ways to improve)[\s\:\*\#\_\-]+(.+)",
    ]

    for pat in header_patterns:
        match = re.search(pat, reasoning, flags=re.IGNORECASE | re.DOTALL)
        if match:
            extracted = match.group(1).strip()
            # Clean up trailing markdown artifacts if any
            extracted = re.split(r"\n\#{1,3}\s", extracted)[0].strip()
            if extracted:
                return extracted

    # Heuristic fallback: find sentences suggesting improvements
    sentences = re.split(r"(?<=[.!?])\s+", reasoning)
    improvement_keywords = ("improve", "raise", "deducted", "missing", "lack", "implement", "add", "could", "should")
    matching_sentences = [
        s.strip() for s in sentences
        if any(kw in s.lower() for kw in improvement_keywords)
    ]

    if matching_sentences:
        return " ".join(matching_sentences[:2])

    return "Review rubric guidelines and verify all edge cases are tested."


# ── Consistency & Variance Calculator ─────────────────────────────────────────

def calculate_consistency_metrics(
    scores: list[float],
    max_marks: float = 100.0,
) -> dict[str, Any]:
    """
    Calculates statistical variance, standard deviation, and stability score
    across repeated grading trials for the same submission.
    """
    if not scores:
        return {
            "runs": 0,
            "mean": 0.0,
            "variance": 0.0,
            "std_dev": 0.0,
            "min_score": 0.0,
            "max_score": 0.0,
            "score_range": 0.0,
            "stability_score": 1.0,
            "is_consistent": True,
        }

    n = len(scores)
    mean = sum(scores) / n

    if n > 1:
        variance = sum((x - mean) ** 2 for x in scores) / (n - 1)
        std_dev = math.sqrt(variance)
    else:
        variance = 0.0
        std_dev = 0.0

    min_score = min(scores)
    max_score = max(scores)
    score_range = max_score - min_score

    # Stability score: 1.0 = zero variance; decreases as range/max_marks increases
    effective_max = max(max_marks, 1.0)
    stability = max(0.0, min(1.0, 1.0 - (score_range / effective_max)))

    # Consistent if standard deviation is within 5% of max marks or <= 3.0 points
    is_consistent = (std_dev <= max(3.0, 0.05 * effective_max))

    return {
        "runs": n,
        "mean": round(mean, 2),
        "variance": round(variance, 3),
        "std_dev": round(std_dev, 2),
        "min_score": round(min_score, 2),
        "max_score": round(max_score, 2),
        "score_range": round(score_range, 2),
        "stability_score": round(stability, 3),
        "is_consistent": is_consistent,
    }
