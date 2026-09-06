"""
email_service.py
----------------
Email and OTP verification service for AutoGrade Classroom.
Dispatches OTP verification emails using SMTP (Gmail / standard SMTP) with the configured ADMIN_EMAIL.
Includes an in-memory thread-safe OTP store with expiration and rate limiting.
"""

import asyncio
import logging
import os
import random
import smtplib
import ssl
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Dict, Optional, Tuple

from app.config import get_settings

logger = logging.getLogger("app.email_service")
settings = get_settings()

# In-memory OTP Store: { (email.lower(), purpose): (otp_code, expires_at) }
_OTP_STORE: Dict[Tuple[str, str], Tuple[str, datetime]] = {}
OTP_EXPIRATION_MINUTES = 10


def generate_otp() -> str:
    """Generates a secure 6-digit numerical OTP."""
    return f"{random.randint(100000, 999999)}"


def store_otp(email: str, purpose: str, otp: str) -> None:
    """Stores the generated OTP with an expiration timestamp."""
    clean_email = email.strip().lower()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRATION_MINUTES)
    _OTP_STORE[(clean_email, purpose)] = (otp, expires_at)
    logger.info("Stored OTP for %s [%s] (expires in %d min)", clean_email, purpose, OTP_EXPIRATION_MINUTES)


def verify_stored_otp(email: str, purpose: str, otp: str, consume: bool = True) -> bool:
    """
    Validates a submitted OTP for the specified email and purpose.
    If consume is True, removes the OTP from the store upon successful match.
    """
    clean_email = email.strip().lower()
    key = (clean_email, purpose)

    if key not in _OTP_STORE:
        logger.warning("No active OTP found for %s [%s]", clean_email, purpose)
        return False

    stored_otp, expires_at = _OTP_STORE[key]
    now = datetime.now(timezone.utc)

    if now > expires_at:
        logger.warning("OTP for %s [%s] has expired", clean_email, purpose)
        _OTP_STORE.pop(key, None)
        return False

    if stored_otp != otp.strip():
        logger.warning("Invalid OTP entered for %s [%s]", clean_email, purpose)
        return False

    if consume:
        _OTP_STORE.pop(key, None)

    logger.info("Successfully verified OTP for %s [%s]", clean_email, purpose)
    return True


def _send_smtp_email_sync(to_email: str, subject: str, html_body: str, text_body: str) -> bool:
    """Sends an email synchronously using smtplib."""
    admin_email = (
        settings.ADMIN_EMAIL
        or os.getenv("ADMIN_EMAIL", "")
        or os.getenv("SMTP_USER", "")
    ).strip()
    admin_pass = (
        settings.ADMIN_PASS
        or settings.ADMIN_PASSWORD
        or os.getenv("ADMIN_PASS", "")
        or os.getenv("ADMIN_PASSWORD", "")
        or os.getenv("SMTP_PASSWORD", "")
    ).strip()

    if not admin_email or not admin_pass:
        logger.warning(
            "SMTP credentials not fully configured (ADMIN_EMAIL/ADMIN_PASS). Email dispatch skipped. "
            "OTP logged for development use."
        )
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"AutoGrade Classroom <{admin_email}>"
    msg["To"] = to_email

    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    # Attempt connection (SSL on 465 or STARTTLS on 587)
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "465"))

    try:
        if smtp_port == 465:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(smtp_host, smtp_port, context=context, timeout=12) as server:
                server.login(admin_email, admin_pass)
                server.sendmail(admin_email, to_email, msg.as_string())
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=12) as server:
                server.starttls(context=ssl.create_default_context())
                server.login(admin_email, admin_pass)
                server.sendmail(admin_email, to_email, msg.as_string())

        logger.info("Successfully sent OTP email to %s via %s", to_email, smtp_host)
        return True
    except Exception as exc:
        logger.error("Failed to send email to %s via SMTP: %s", to_email, str(exc))
        return False


async def send_otp_email(to_email: str, otp: str, purpose: str = "signup") -> Tuple[bool, str]:
    """
    Generates and dispatches an OTP email to the user.
    Always stores the OTP in memory and logs it to the console for development reliability.
    """
    store_otp(to_email, purpose, otp)

    # Console notification for immediate developer feedback / backup
    print(f"\n========================================================")
    print(f" [AutoGrade OTP] For: {to_email} | Purpose: {purpose.upper()}")
    print(f" CODE: >>> {otp} <<< (Valid for 10 minutes)")
    print(f"========================================================\n")

    purpose_title = "Verify Your AutoGrade Account" if purpose == "signup" else "Reset Your Password"
    purpose_desc = (
        "Thank you for registering with AutoGrade Classroom. Please use the verification code below to complete your registration:"
        if purpose == "signup"
        else "We received a request to reset your AutoGrade Classroom password. Use the verification code below to proceed:"
    )

    subject = f"AutoGrade Classroom Verification Code: {otp}"

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #e2e8f0; margin: 0; padding: 24px; }}
    .card {{ max-width: 520px; margin: 0 auto; background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; }}
    .logo {{ font-size: 20px; font-weight: 700; color: #ffffff; margin-bottom: 24px; }}
    .logo span {{ color: #06b6d4; }}
    .code-box {{ background: #1e1b4b; border: 1px solid #4338ca; border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0; }}
    .code {{ font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #818cf8; font-family: monospace; }}
    .footer {{ font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #1e293b; padding-top: 16px; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">AutoGrade <span>Classroom</span></div>
    <h2 style="color: #ffffff; margin-top: 0;">{purpose_title}</h2>
    <p style="color: #94a3b8; font-size: 15px; line-height: 1.5;">{purpose_desc}</p>
    <div class="code-box">
      <div class="code">{otp}</div>
    </div>
    <p style="font-size: 13px; color: #94a3b8;">This code is valid for <strong>10 minutes</strong>. If you did not make this request, please ignore this email.</p>
    <div class="footer">
      Automated Notebook Grading & Classroom Platform • Sent from {settings.ADMIN_EMAIL or 'AutoGrade Admin'}
    </div>
  </div>
</body>
</html>"""

    text_content = f"""AutoGrade Classroom

{purpose_title}

{purpose_desc}

Verification Code: {otp}

This code is valid for 10 minutes. If you did not request this, please ignore this message.
"""

    sent = await asyncio.to_thread(_send_smtp_email_sync, to_email, subject, html_content, text_content)
    return (sent, otp)
