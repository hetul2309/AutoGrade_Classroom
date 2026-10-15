"""
backend/app/trustgrade/explain.py
---------------------------------
Explainability engine for per-criterion rubric evaluation and consistency scoring.
(Activated during Stage 4).
"""

from typing import Dict, Any


def format_explainable_breakdown(criterion_scores: Dict[str, Any]) -> str:
    """Formats per-criterion scores into structured markdown rationale."""
    lines = []
    for criterion, details in criterion_scores.items():
        lines.append(f"- **{criterion}**: {details.get('marks', 0)}/{details.get('max', 0)} — {details.get('comment', '')}")
    return "\n".join(lines)
