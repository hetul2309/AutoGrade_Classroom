"""
backend/app/trustgrade/config.py
--------------------------------
Configuration and state management for the TrustGrade security and explainability layer.
"""

import os
import secrets
from app.config import get_settings


def is_trustgrade_enabled() -> bool:
    """Returns True if the TrustGrade feature flag is active."""
    env_val = os.environ.get("TRUSTGRADE_ENABLED")
    if env_val is not None:
        return env_val.strip().lower() in ("true", "1", "yes", "on")
    try:
        settings = get_settings()
        return bool(getattr(settings, "TRUSTGRADE_ENABLED", False))
    except Exception:
        return False


# In-memory session canary token (changes per server restart, never stored in DB or client)
_SESSION_CANARY: str = f"TG_CANARY_{secrets.token_hex(8).upper()}"


def get_canary_token() -> str:
    """Returns the active TrustGrade canary token."""
    return _SESSION_CANARY
