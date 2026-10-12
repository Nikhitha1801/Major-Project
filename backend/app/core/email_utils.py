"""
Sends attendance report emails to faculty after a class session is
completed. Configured entirely through environment variables (see
backend/.env.example) so no credentials live in code.

If SMTP isn't configured, or sending fails for any reason, this logs a
warning and returns False rather than raising -- a broken mail server
should never prevent a faculty member from finishing a class session.
"""
import os
import smtplib
import ssl
import logging
from datetime import datetime
from html import escape
from email.message import EmailMessage
from typing import List, Optional

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("attendify.email")

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER)
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() != "false"


def is_configured() -> bool:
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASSWORD)


def _send_message(msg: EmailMessage, to_email: str, notification: str) -> bool:
    if not is_configured():
        logger.warning("SMTP not configured; skipping %s email to %s", notification, to_email)
        return False
    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            if SMTP_USE_TLS:
                server.starttls(context=context)
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception:
        logger.exception("Failed to send %s email to %s", notification, to_email)
        return False


def send_swap_request_email(
    *,
    to_email: str,
    target_name: str,
    requester_name: str,
    subject_code: str,
    subject_name: str,
    section: str,
    swap_date: str,
    start_time: str,
    end_time: str,
    reason: str,
) -> bool:
    course = f"{subject_code} — {subject_name}"
    msg = EmailMessage()
    msg["Subject"] = f"[Attendify] Swap request: {course} on {swap_date}"
    msg["From"] = SMTP_FROM
    msg["To"] = to_email
    msg.set_content(
        f"Dear {target_name},\n\n"
        f"{requester_name} has asked you to cover {course}, Section {section}, "
        f"on {swap_date} from {start_time} to {end_time}.\n"
        f"Reason: {reason or 'Not specified'}\n\n"
        "Please log in to Attendify, open Faculty > Swap Requests, and accept or reject the request.\n\n"
        "Attendify"
    )
    msg.add_alternative(
        f"""\
<html><body style="margin:0;padding:24px;background:#f3f6fa;font-family:Arial,sans-serif;color:#243247;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-collapse:collapse;">
    <tr><td style="padding:24px 30px;background:#24539a;color:#fff;"><div style="font-size:12px;">GSSSIETW</div><h2 style="margin:8px 0 0;">Class swap request</h2></td></tr>
    <tr><td style="padding:28px 30px;">
      <p>Dear {escape(target_name)},</p>
      <p><strong>{escape(requester_name)}</strong> has asked you to cover this class:</p>
      <p style="padding:16px;background:#f1f5f9;border-radius:8px;line-height:1.7;">
        <strong>{escape(course)}</strong><br>Section {escape(section)}<br>
        {escape(swap_date)} · {escape(start_time)}–{escape(end_time)}<br>
        Reason: {escape(reason or 'Not specified')}
      </p>
      <p>Log in to Attendify, open <strong>Faculty → Swap Requests</strong>, and choose Accept or Reject.</p>
    </td></tr>
  </table>
</body></html>
""",
        subtype="html",
    )
    return _send_message(msg, to_email, "swap request")


def send_swap_decision_email(
    *,
    to_email: str,
    requester_name: str,
    decision: str,
    deciding_name: str,
    subject_code: str,
    subject_name: str,
    section: str,
    swap_date: str,
) -> bool:
    accepted = decision == "approved"
    result = "accepted" if accepted else "rejected"
    course = f"{subject_code} — {subject_name}"
    color = "087f5b" if accepted else "c62828"
    msg = EmailMessage()
    msg["Subject"] = f"[Attendify] Swap request {result}: {course}"
    msg["From"] = SMTP_FROM
    msg["To"] = to_email
    msg.set_content(
        f"Dear {requester_name},\n\n"
        f"{deciding_name} has {result} your swap request for {course}, "
        f"Section {section}, on {swap_date}.\n\nAttendify"
    )
    msg.add_alternative(
        f"""\
<html><body style="margin:0;padding:24px;background:#f3f6fa;font-family:Arial,sans-serif;color:#243247;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-collapse:collapse;">
    <tr><td style="padding:26px 30px;background:#{color};color:#fff;"><div style="font-size:12px;">GSSSIETW</div><h2 style="margin:8px 0 0;">Swap request {result}</h2></td></tr>
    <tr><td style="padding:28px 30px;">
      <p>Dear {escape(requester_name)},</p>
      <p>{escape(deciding_name)} has <strong>{result}</strong> your swap request.</p>
      <p style="padding:16px;background:#f1f5f9;border-radius:8px;line-height:1.7;">
        <strong>{escape(course)}</strong><br>Section {escape(section)}<br>{escape(swap_date)}
      </p>
    </td></tr>
  </table>
</body></html>
""",
        subtype="html",
    )
    return _send_message(msg, to_email, "swap decision")


def send_attendance_report(
    to_email: str,
    faculty_name: str,
    subject_name: str,
    section: str,
    session_date: str,
    present_students: List[str],
    absent_students: List[str],
    room: Optional[str] = None,
    excel_attachment: Optional[bytes] = None,
) -> bool:
    if not is_configured():
        logger.warning(
            "SMTP not configured (missing SMTP_HOST/SMTP_USER/SMTP_PASSWORD in .env) "
            "-- skipping attendance report email to %s", to_email
        )
        return False

    total = len(present_students) + len(absent_students)
    pct = round((len(present_students) / total) * 100, 1) if total else 0.0

    msg = EmailMessage()
    msg["Subject"] = f"Attendance Report – {subject_name} (Sec {section}) – {session_date}"
    msg["From"] = SMTP_FROM
    msg["To"] = to_email

    report_time = datetime.now().strftime("%H:%M")
    safe_faculty = escape(faculty_name)
    safe_subject = escape(subject_name)
    safe_section = escape(section)
    safe_date = escape(session_date)
    safe_room = escape(room or "—")
    text_lines = [
        f"Dear {faculty_name},",
        "",
        f"Your attendance report for {subject_name} (Section {section}) is ready.",
        "",
        f"Date & time: {session_date} {report_time}",
        f"Room: {room or '—'}",
        f"Present: {len(present_students)} / {total}",
        f"Attendance: {pct:.1f}%",
        "",
        "The student-wise report is attached as an Excel workbook.",
        "",
        "— Attendify",
    ]
    msg.set_content("\n".join(text_lines))

    msg.add_alternative(
        f"""\
<html>
  <body style="margin:0;padding:24px;background:#f3f6fa;font-family:Arial,sans-serif;color:#243247;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-collapse:collapse;">
      <tr>
        <td style="padding:28px 36px;background:#24539a;color:#ffffff;">
          <div style="font-size:12px;letter-spacing:1px;">GSSSIETW</div>
          <h1 style="margin:8px 0 0;font-size:24px;">Attendance Report</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 36px;">
          <p style="margin:0 0 18px;">Dear {safe_faculty},</p>
          <p style="margin:0 0 20px;">Your report for <strong>{safe_subject}</strong> — Section <strong>{safe_section}</strong> is ready.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;border-radius:8px;">
            <tr>
              <td width="60%" style="padding:18px 20px 10px;color:#64748b;font-size:13px;">Date &amp; Time</td>
              <td width="40%" style="padding:18px 20px 10px;color:#64748b;font-size:13px;">Room</td>
            </tr>
            <tr>
              <td style="padding:0 20px 18px;font-weight:bold;">{safe_date} {report_time}</td>
              <td style="padding:0 20px 18px;font-weight:bold;">{safe_room}</td>
            </tr>
            <tr>
              <td style="padding:10px 20px 8px;color:#64748b;font-size:13px;">Present</td>
              <td style="padding:10px 20px 8px;color:#64748b;font-size:13px;">Attendance</td>
            </tr>
            <tr>
              <td style="padding:0 20px 20px;font-size:24px;font-weight:bold;">{len(present_students)} / {total}</td>
              <td style="padding:0 20px 20px;font-size:24px;font-weight:bold;color:#dc2626;">{pct:.1f}%</td>
            </tr>
          </table>
          <p style="margin:22px 0 0;color:#526176;">The student-wise attendance report is attached as an Excel workbook.</p>
          <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;">Sent automatically by Attendify.</p>
        </td>
      </tr>
    </table>
  </body>
</html>
""",
        subtype="html",
    )

    if excel_attachment:
        msg.add_attachment(
            excel_attachment,
            maintype="application",
            subtype="vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=f"attendance_report_{session_date}.xlsx",
        )

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            if SMTP_USE_TLS:
                server.starttls(context=context)
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception:
        logger.exception("Failed to send attendance report email to %s", to_email)
        return False
