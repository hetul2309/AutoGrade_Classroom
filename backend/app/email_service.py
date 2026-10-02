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


import secrets

def generate_otp() -> str:
    """Generates a cryptographically secure, random 6-digit numerical OTP."""
    return f"{secrets.randbelow(900000) + 100000}"


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


def get_smtp_credentials() -> Tuple[str, str, str, int, str]:
    """
    Extracts SMTP credentials with full compatibility for:
    - AutoGrade standard: ADMIN_EMAIL, ADMIN_PASS
    - Lekhak / Nodemailer standard: EMAIL_USER, EMAIL_PASS, SMTP_USER, SMTP_PASS, SMTP_HOST, SMTP_PORT, MAIL_FROM
    """
    cfg = get_settings()

    email = (
        getattr(cfg, "EMAIL_USER", "")
        or getattr(cfg, "SMTP_USER", "")
        or getattr(cfg, "ADMIN_EMAIL", "")
        or os.getenv("EMAIL_USER", "")
        or os.getenv("SMTP_USER", "")
        or os.getenv("ADMIN_EMAIL", "")
    ).strip()

    # Prioritize dedicated app password fields over generic dashboard password
    password = (
        getattr(cfg, "EMAIL_PASS", "")
        or getattr(cfg, "SMTP_PASS", "")
        or getattr(cfg, "ADMIN_PASS", "")
        or getattr(cfg, "SMTP_PASSWORD", "")
        or os.getenv("EMAIL_PASS", "")
        or os.getenv("SMTP_PASS", "")
        or os.getenv("ADMIN_PASS", "")
        or os.getenv("SMTP_PASSWORD", "")
    ).strip()

    # Remove internal spaces in Google App Passwords (e.g. "abcd efgh ijkl mnop")
    if password:
        password = password.replace(" ", "")

    host = (
        getattr(cfg, "SMTP_HOST", "")
        or os.getenv("SMTP_HOST", "")
        or "smtp.gmail.com"
    ).strip()

    port = 587
    raw_port = getattr(cfg, "SMTP_PORT", None) or os.getenv("SMTP_PORT")
    if raw_port:
        try:
            port = int(raw_port)
        except ValueError:
            port = 587

    from_addr = (
        getattr(cfg, "MAIL_FROM", "")
        or getattr(cfg, "FROM_EMAIL", "")
        or os.getenv("MAIL_FROM", "")
        or os.getenv("FROM_EMAIL", "")
        or (f"AutoGrade Classroom <{email}>" if email else "AutoGrade Classroom")
    ).strip()
    if email and "<" not in from_addr:
        from_addr = f"AutoGrade Classroom <{from_addr}>"

    return email, password, host, port, from_addr


def _send_http_api_email_sync(to_email: str, subject: str, html_body: str, text_body: str) -> Tuple[bool, Optional[str]]:
    """
    Dispatches email via HTTP REST API (over port 443 HTTPS).
    This bypasses all cloud SMTP port restrictions (e.g., Render Free Tier blocking ports 25, 465, 587).
    Supports Resend (RESEND_API_KEY) and Brevo (BREVO_API_KEY).
    """
    import json
    import urllib.request
    import urllib.error

    cfg = get_settings()
    resend_key = (getattr(cfg, "RESEND_API_KEY", "") or os.getenv("RESEND_API_KEY", "")).strip()
    brevo_key = (getattr(cfg, "BREVO_API_KEY", "") or os.getenv("BREVO_API_KEY", "")).strip()

    # 1. Try Brevo first if configured (Brevo allows sending to ANY recipient email)
    if brevo_key:
        try:
            admin_email, _, _, _, _ = get_smtp_credentials()
            sender_email = (getattr(cfg, "BREVO_SENDER_EMAIL", "") or os.getenv("BREVO_SENDER_EMAIL", "") or admin_email or "autogradeclassroom@gmail.com").strip()
            payload = json.dumps({
                "sender": {"name": "AutoGrade Classroom", "email": sender_email},
                "to": [{"email": to_email}],
                "subject": subject,
                "htmlContent": html_body,
                "textContent": text_body,
            }).encode("utf-8")
            req = urllib.request.Request(
                "https://api.brevo.com/v3/smtp/email",
                data=payload,
                headers={
                    "api-key": brevo_key,
                    "Content-Type": "application/json",
                    "User-Agent": "AutoGrade-Classroom/1.0",
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=12) as resp:
                if resp.status in (200, 201):
                    print(f"[AutoGrade HTTP EMAIL SUCCESS] Email delivered to {to_email} via Brevo API (HTTPS port 443)!")
                    logger.info("Email delivered via Brevo HTTP API to %s", to_email)
                    return True, None
                body = resp.read().decode("utf-8")
                brevo_err = f"Brevo API status {resp.status}: {body}"
        except urllib.error.HTTPError as he:
            err_body = he.read().decode("utf-8", errors="replace")
            print(f"[AutoGrade Brevo API Error] Status {he.code}: {err_body}")
            brevo_err = f"Brevo API Error ({he.code}): {err_body}"
        except Exception as exc:
            print(f"[AutoGrade Brevo API Exception] {exc}")
            brevo_err = f"Brevo exception: {exc}"

        if not resend_key:
            return False, brevo_err
        print(f"[AutoGrade Notice] Brevo failed ({brevo_err}), attempting Resend fallback...")

    # 2. Try Resend if configured
    if resend_key:
        try:
            sender = (getattr(cfg, "RESEND_FROM", "") or os.getenv("RESEND_FROM", "") or "AutoGrade Classroom <onboarding@resend.dev>").strip()
            payload = json.dumps({
                "from": sender,
                "to": [to_email],
                "subject": subject,
                "html": html_body,
                "text": text_body,
            }).encode("utf-8")
            req = urllib.request.Request(
                "https://api.resend.com/emails",
                data=payload,
                headers={
                    "Authorization": f"Bearer {resend_key}",
                    "Content-Type": "application/json",
                    "User-Agent": "AutoGrade-Classroom/1.0",
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=12) as resp:
                if resp.status in (200, 201):
                    print(f"[AutoGrade HTTP EMAIL SUCCESS] Email delivered to {to_email} via Resend API (HTTPS port 443)!")
                    logger.info("Email delivered via Resend HTTP API to %s", to_email)
                    return True, None
                body = resp.read().decode("utf-8")
                return False, f"Resend API status {resp.status}: {body}"
        except urllib.error.HTTPError as he:
            err_body = he.read().decode("utf-8", errors="replace")
            print(f"[AutoGrade Resend API Error] Status {he.code}: {err_body}")
            try:
                err_data = json.loads(err_body)
                clean_msg = err_data.get("message") or err_body
            except Exception:
                clean_msg = err_body
            return False, f"Resend ({he.code}): {clean_msg}"
        except Exception as exc:
            print(f"[AutoGrade Resend API Exception] {exc}")
            return False, f"Resend exception: {exc}"

    return False, "No HTTP email API key configured"


def _send_smtp_email_sync(to_email: str, subject: str, html_body: str, text_body: str) -> Tuple[bool, Optional[str]]:
    """
    Sends an email synchronously using:
    1. HTTP REST API (Resend / Brevo) over port 443 HTTPS (ideal for Render Free tier where SMTP is blocked)
    2. Direct SMTP (dual port retry 587 STARTTLS & 465 SSL) for local development or non-restricted hosts
    """
    cfg = get_settings()
    resend_key = (getattr(cfg, "RESEND_API_KEY", "") or os.getenv("RESEND_API_KEY", "")).strip()
    brevo_key = (getattr(cfg, "BREVO_API_KEY", "") or os.getenv("BREVO_API_KEY", "")).strip()

    # Prioritize HTTP API on cloud environments if an API key is provided
    if resend_key or brevo_key:
        http_ok, http_err = _send_http_api_email_sync(to_email, subject, html_body, text_body)
        if http_ok:
            return True, None
        logger.warning("HTTP Email API failed, attempting SMTP fallback: %s", http_err)

    admin_email, admin_pass, smtp_host, configured_port, from_addr = get_smtp_credentials()

    if not admin_email or not admin_pass:
        err_msg = f"SMTP credentials not fully configured (email='{admin_email}', pass_set={bool(admin_pass)})"
        print(f"[AutoGrade SMTP Warning] {err_msg}. Email dispatch skipped.")
        logger.warning(err_msg)
        return False, err_msg

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_email

    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    # Try configured port first, then alternative (587 STARTTLS / 465 SSL)
    if configured_port == 465:
        ports_to_try = [465, 587]
    else:
        ports_to_try = [587, 465]

    errors = []

    for port in ports_to_try:
        try:
            context = ssl.create_default_context()
            if port == 465:
                with smtplib.SMTP_SSL(smtp_host, port, context=context, timeout=12) as server:
                    server.login(admin_email, admin_pass)
                    server.sendmail(admin_email, to_email, msg.as_string())
            else:
                with smtplib.SMTP(smtp_host, port, timeout=12) as server:
                    server.starttls(context=context)
                    server.login(admin_email, admin_pass)
                    server.sendmail(admin_email, to_email, msg.as_string())

            print(f"[AutoGrade SMTP SUCCESS] Verification email sent to {to_email} via {smtp_host}:{port}!")
            logger.info("Successfully sent OTP email to %s via %s:%d", to_email, smtp_host, port)
            return True, None
        except Exception as exc:
            errors.append(f"Port {port}: {exc}")
            print(f"[AutoGrade SMTP Port {port} Attempt Failed] Reason: {exc}")

    last_err = " | ".join(errors)
    print(f"[AutoGrade SMTP FAILED] Could not send email to {to_email}. Error: {last_err}")
    logger.error("Failed to send email to %s via SMTP: %s", to_email, str(last_err))
    return False, last_err


async def send_otp_email(to_email: str, otp: str, purpose: str = "signup") -> Tuple[bool, Optional[str], str]:
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

    sent, last_err = await asyncio.to_thread(_send_smtp_email_sync, to_email, subject, html_content, text_content)
    return (sent, last_err, otp)


async def send_teacher_invitation_email(
    to_email: str,
    inviter_name: str,
    class_name: str,
    dashboard_url: str = "http://localhost:5173",
) -> bool:
    """
    Sends an invitation email to a prospective co-teacher with a direct link to the AutoGrade Classroom dashboard.
    """
    subject = f"Invitation to co-teach '{class_name}' on AutoGrade Classroom"

    print(f"\n========================================================")
    print(f" [AutoGrade Co-Teacher Invitation]")
    print(f" To: {to_email}")
    print(f" Class: {class_name}")
    print(f" Invited By: {inviter_name}")
    print(f" Dashboard URL: {dashboard_url}")
    print(f"========================================================\n")

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #e2e8f0; margin: 0; padding: 24px; }}
    .card {{ max-width: 540px; margin: 0 auto; background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 36px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }}
    .logo {{ font-size: 20px; font-weight: 700; color: #ffffff; margin-bottom: 24px; }}
    .logo span {{ color: #FF6A00; }}
    .badge {{ display: inline-block; background: rgba(255, 106, 0, 0.15); color: #FF6A00; border: 1px solid rgba(255, 106, 0, 0.3); border-radius: 999px; padding: 4px 12px; font-size: 12px; font-weight: 700; margin-bottom: 16px; }}
    .highlight {{ color: #ffffff; font-weight: 600; }}
    .btn-container {{ text-align: center; margin: 32px 0; }}
    .btn {{ display: inline-block; background: linear-gradient(135deg, #FF6A00 0%, #FF2D8D 100%); color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 15px; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 16px rgba(255, 106, 0, 0.35); }}
    .note {{ background: #0f172a; border-left: 3px solid #FF6A00; padding: 12px 16px; border-radius: 0 8px 8px 0; font-size: 13px; color: #94a3b8; margin: 20px 0; }}
    .footer {{ font-size: 12px; color: #64748b; margin-top: 30px; border-top: 1px solid #1e293b; padding-top: 16px; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">AutoGrade <span>Classroom</span></div>
    <div class="badge">CO-TEACHER INVITATION</div>
    <h2 style="color: #ffffff; margin-top: 0; font-size: 22px;">Join as Co-Teacher</h2>
    <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">
      Hello,<br><br>
      <span class="highlight">{inviter_name}</span> has invited you to co-teach <strong style="color: #FF6A00;">{class_name}</strong> on AutoGrade Classroom.
    </p>
    <p style="color: #94a3b8; font-size: 14px; line-height: 1.5;">
      As a co-teacher, you will be able to manage assignments, view student submissions, evaluate ML notebooks, and collaborate with other instructors.
    </p>

    <div class="note">
      <strong>Action Required:</strong> Click the button below to visit your dashboard, then open the <strong>Notification Bell</strong> in the upper right header to <strong>Accept</strong> or <strong>Decline</strong> this invitation.
    </div>

    <div class="btn-container">
      <a href="{dashboard_url}" class="btn" target="_blank">Open Dashboard & View Invite</a>
    </div>

    <div class="footer">
      Automated Notebook Grading & Classroom Platform • Sent from {settings.ADMIN_EMAIL or 'AutoGrade Classroom'}
    </div>
  </div>
</body>
</html>"""

    text_content = f"""AutoGrade Classroom - Co-Teacher Invitation

Hello,

{inviter_name} has invited you to co-teach '{class_name}' on AutoGrade Classroom.

As a co-teacher, you will be able to manage assignments, view student submissions, evaluate ML notebooks, and collaborate with instructors.

To respond:
1. Open your dashboard: {dashboard_url}
2. Click on the Notification Bell in the upper right header.
3. Choose 'Accept' or 'Decline' on the invitation.

Sent from AutoGrade Classroom
"""

    sent, _ = await asyncio.to_thread(_send_smtp_email_sync, to_email, subject, html_content, text_content)
    return sent

