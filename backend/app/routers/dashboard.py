from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from .. import models
from ..database import get_db
from ..core.deps import require_roles, get_current_user

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/admin")
def admin_dashboard(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin")),
):
    total_students = db.query(models.User).filter(models.User.role == "student").count()
    total_faculty = db.query(models.User).filter(models.User.role.in_(["faculty", "hod"])).count()
    total_admin = db.query(models.User).filter(models.User.role == "admin").count()
    total_departments = db.query(models.Department).count()
    total_sessions = db.query(models.AttendanceSession).count()

    today_dow = date.today().weekday()
    today_classes = db.query(models.TimetableEntry).filter(
        models.TimetableEntry.day_of_week == today_dow
    ).count()

    by_dept = []
    for dept in db.query(models.Department).all():
        student_count = (
            db.query(models.User)
            .filter(models.User.department_id == dept.id, models.User.role == "student")
            .count()
        )
        faculty_count = (
            db.query(models.User)
            .filter(models.User.department_id == dept.id, models.User.role.in_(["faculty", "hod"]))
            .count()
        )
        by_dept.append({
            "department": dept.name,
            "code": dept.code,
            "students": student_count,
            "faculty": faculty_count,
        })

    # weekly attendance trend across all departments (last 7 days)
    trend = []
    today = date.today()
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        records = (
            db.query(models.AttendanceRecord)
            .join(models.AttendanceSession)
            .filter(models.AttendanceSession.session_date == day)
            .all()
        )
        total = len(records)
        present = len([r for r in records if r.status.value == "present"])
        pct = round((present / total * 100), 1) if total else 0
        trend.append({"date": day.isoformat(), "percentage": pct})

    role_distribution = [
        {"role": "Students", "count": total_students},
        {"role": "Faculty", "count": total_faculty},
        {"role": "Admin", "count": total_admin},
    ]

    return {
        "total_students": total_students,
        "total_faculty": total_faculty,
        "total_users": total_students + total_faculty + total_admin,
        "total_departments": total_departments,
        "total_sessions": total_sessions,
        "today_classes": today_classes,
        "by_department": by_dept,
        "weekly_trend": trend,
        "role_distribution": role_distribution,
    }


@router.get("/hod")
def hod_dashboard(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("hod")),
):
    dept_id = current_user.department_id
    students = (
        db.query(models.User)
        .filter(models.User.department_id == dept_id, models.User.role == "student")
        .count()
    )
    faculty = (
        db.query(models.User)
        .filter(models.User.department_id == dept_id, models.User.role == "faculty")
        .count()
    )
    subjects = db.query(models.Subject).filter(models.Subject.department_id == dept_id).count()

    # Weekly attendance trend for department (last 7 days)
    trend = []
    today = date.today()
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        records = (
            db.query(models.AttendanceRecord)
            .join(models.AttendanceSession)
            .join(models.Subject)
            .filter(
                models.Subject.department_id == dept_id,
                models.AttendanceSession.session_date == day,
            )
            .all()
        )
        total = len(records)
        present = len([r for r in records if r.status.value == "present"])
        pct = round((present / total * 100), 1) if total else 0
        trend.append({"date": day.isoformat(), "percentage": pct})

    return {
        "students": students,
        "faculty": faculty,
        "subjects": subjects,
        "weekly_trend": trend,
    }


@router.get("/faculty")
def faculty_dashboard(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("faculty", "hod")),
):
    today_dow = date.today().weekday()
    today_classes = (
        db.query(models.TimetableEntry)
        .filter(
            models.TimetableEntry.faculty_id == current_user.id,
            models.TimetableEntry.day_of_week == today_dow,
        )
        .order_by(models.TimetableEntry.start_time)
        .all()
    )
    recent_sessions = (
        db.query(models.AttendanceSession)
        .filter(models.AttendanceSession.faculty_id == current_user.id)
        .order_by(models.AttendanceSession.session_date.desc())
        .limit(5)
        .all()
    )

    return {
        "today_classes": [
            {
                "id": c.id,
                "subject": c.subject.name,
                "section": c.section,
                "start_time": c.start_time,
                "end_time": c.end_time,
                "room": c.room,
            }
            for c in today_classes
        ],
        "recent_sessions": [
            {
                "id": s.id,
                "subject": s.subject.name,
                "section": s.section,
                "date": s.session_date.isoformat(),
                "present": len([r for r in s.records if r.status.value == "present"]),
                "total": len(s.records),
            }
            for s in recent_sessions
        ],
    }


@router.get("/student")
def student_dashboard(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("student")),
):
    profile = current_user.student_profile
    records = (
        db.query(models.AttendanceRecord)
        .filter(models.AttendanceRecord.student_id == profile.id)
        .all()
    )
    total = len(records)
    present = len([r for r in records if r.status.value == "present"])
    pct = round((present / total * 100), 1) if total else 0

    recent = sorted(records, key=lambda r: r.marked_at, reverse=True)[:5]

@router.get("/admin/analytics")
def admin_analytics(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin")),
):
    """30-day attendance trend, plus a breakdown by section and by subject
    -- distinct from the 7-day snapshot on the main Overview dashboard."""
    today = date.today()

    trend_30d = []
    for i in range(29, -1, -1):
        day = today - timedelta(days=i)
        records = (
            db.query(models.AttendanceRecord)
            .join(models.AttendanceSession)
            .filter(models.AttendanceSession.session_date == day)
            .all()
        )
        total = len(records)
        present = len([r for r in records if r.status.value == "present"])
        trend_30d.append({
            "date": day.isoformat(),
            "percentage": round((present / total * 100), 1) if total else None,
        })

    by_section = defaultdict(lambda: {"present": 0, "total": 0})
    by_subject = defaultdict(lambda: {"present": 0, "total": 0})
    all_records = (
        db.query(models.AttendanceRecord)
        .join(models.AttendanceSession)
        .filter(models.AttendanceSession.session_date >= today - timedelta(days=30))
        .all()
    )
    for r in all_records:
        section = r.session.section
        subject = r.session.subject.name
        by_section[section]["total"] += 1
        by_subject[subject]["total"] += 1
        if r.status.value == "present":
            by_section[section]["present"] += 1
            by_subject[subject]["present"] += 1

    section_breakdown = [
        {"section": k, "percentage": round(v["present"] / v["total"] * 100, 1) if v["total"] else 0, "sessions": v["total"]}
        for k, v in sorted(by_section.items())
    ]
    subject_breakdown = [
        {"subject": k, "percentage": round(v["present"] / v["total"] * 100, 1) if v["total"] else 0, "sessions": v["total"]}
        for k, v in sorted(by_subject.items(), key=lambda kv: -kv[1]["total"])
    ]

    return {
        "trend_30d": trend_30d,
        "section_breakdown": section_breakdown,
        "subject_breakdown": subject_breakdown,
    }


@router.get("/hod/analytics")
def hod_analytics(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("hod")),
):
    """Department-scoped attendance analytics for the last 30 days."""
    today = date.today()
    start_date = today - timedelta(days=29)
    records = (
        db.query(models.AttendanceRecord)
        .join(models.AttendanceSession)
        .join(models.Subject)
        .filter(
            models.Subject.department_id == current_user.department_id,
            models.AttendanceSession.session_date >= start_date,
            models.AttendanceSession.session_date <= today,
        )
        .all()
    )

    daily = defaultdict(lambda: {"present": 0, "total": 0})
    by_section = defaultdict(lambda: {"present": 0, "total": 0})
    by_subject = defaultdict(lambda: {"present": 0, "total": 0})
    session_ids = set()
    present_count = 0

    for record in records:
        session = record.session
        is_present = record.status == models.AttendanceStatus.present
        session_ids.add(session.id)
        daily[session.session_date]["total"] += 1
        by_section[session.section]["total"] += 1
        by_subject[session.subject.name]["total"] += 1
        if is_present:
            present_count += 1
            daily[session.session_date]["present"] += 1
            by_section[session.section]["present"] += 1
            by_subject[session.subject.name]["present"] += 1

    def percentage(counts):
        return round(counts["present"] / counts["total"] * 100, 1) if counts["total"] else 0

    trend_30d = []
    for offset in range(29, -1, -1):
        day = today - timedelta(days=offset)
        counts = daily[day]
        trend_30d.append({
            "date": day.isoformat(),
            "percentage": percentage(counts) if counts["total"] else None,
            "records": counts["total"],
        })

    section_breakdown = [
        {"section": section, "percentage": percentage(counts), "records": counts["total"]}
        for section, counts in sorted(by_section.items())
    ]
    subject_breakdown = [
        {"subject": subject, "percentage": percentage(counts), "records": counts["total"]}
        for subject, counts in sorted(by_subject.items(), key=lambda item: -item[1]["total"])
    ]

    total_records = len(records)
    return {
        "start_date": start_date.isoformat(),
        "end_date": today.isoformat(),
        "total_sessions": len(session_ids),
        "total_records": total_records,
        "present_records": present_count,
        "attendance_rate": round(present_count / total_records * 100, 1) if total_records else 0,
        "trend_30d": trend_30d,
        "section_breakdown": section_breakdown,
        "subject_breakdown": subject_breakdown,
    }
