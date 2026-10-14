"""
TrustGrade Security and Explainability Layer for AutoGrade Classroom.
"""

from app.config import get_settings

def is_trustgrade_enabled() -> bool:
    """Returns True if TrustGrade security & explainability layer is enabled."""
    return get_settings().TRUSTGRADE_ENABLED
