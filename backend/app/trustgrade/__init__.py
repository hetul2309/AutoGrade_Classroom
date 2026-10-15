"""
TrustGrade Security and Explainability Layer for AutoGrade Classroom.
"""

from app.trustgrade.config import is_trustgrade_enabled, get_canary_token

__all__ = ["is_trustgrade_enabled", "get_canary_token"]
