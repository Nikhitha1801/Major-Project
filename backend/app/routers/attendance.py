from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..core.deps import get_current_user, require_roles
from ..core import face_engine, email_utils
from ..core.attendance_report import build_attendance_workbook

router = APIRouter(prefix="/attendance", tags=["attendance"])


def get_settings(db: Session) -> models.SystemSettings:
    settings = db.query(models.SystemSettings).filter(models.SystemSettings.id == 1).first()
    if not settings:
        settings = models.SystemSettings(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def _effective_faculty_id(db: Session, entry: models.TimetableEntry, on_date: date) -> int:
    """Returns who should actually take this class today: the timetable's
    assigned faculty, unless an approved swap hands it to someone else."""
    swap = (
        db.query(models.SwapRequest)
        .filter(
            models.SwapRequest.timetable_entry_id == entry.id,
            models.SwapRequest.swap_date == on_date,
            models.SwapRequest.status == models.SwapStatus.approved,
            models.SwapRequest.target_faculty_id.isnot(None),
        )
        .first()
    )
    return swap.target_faculty_id if swap else entry.faculty_id


def _slot_status(start_time: str, end_time: str) -> str:
    now_str = datetime.now().strftime("%H:%M")
    if start_time <= now_str <= end_time:
        return "now"
    if now_str < start_time:
        return "upcoming"
    return "past"


def _section_roster(db: Session, section: str) -> List[models.User]:
    return (
        db.query(models.User)
        .join(models.StudentProfile)
        .filter(models.User.role == models.RoleEnum.student)
        .filter(models.StudentProfile.section == section)
        .all()
    )


@router.post("/sessions", response_model=schemas.AttendanceSessionOut, status_code=status.HTTP_201_CREATED)
def submit_attendance(
    payload: schemas.AttendanceSubmit,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("faculty", "hod")),
):
    subject = db.query(models.Subject).filter(models.Subject.id == payload.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    session = models.AttendanceSession(
        subject_id=payload.subject_id,
        faculty_id=current_user.id,
        section=payload.section,
        session_date=payload.session_date or date.today(),
    )
    db.add(session)
    db.flush()

    for item in payload.records:
        record = models.AttendanceRecord(
            session_id=session.id,
            student_id=item.student_id,
            status=item.status,
            method="manual",
        )
        db.add(record)

    db.commit()
    db.refresh(session)
    return session


@router.get("/sessions", response_model=List[schemas.AttendanceSessionOut])
def list_sessions(
    subject_id: Optional[int] = None,
    section: Optional[str] = None,
    faculty_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.AttendanceSession)
    if subject_id:
        query = query.filter(models.AttendanceSession.subject_id == subject_id)
    if section:
        query = query.filter(models.AttendanceSession.section == section)
    if faculty_id:
        query = query.filter(models.AttendanceSession.faculty_id == faculty_id)
    if current_user.role.value == "faculty" and faculty_id is None:
        query = query.filter(models.AttendanceSession.faculty_id == current_user.id)
    return query.order_by(models.AttendanceSession.session_date.desc()).all()


@router.get("/my-summary", response_model=List[schemas.StudentAttendanceSummary])
def my_attendance_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("student")),
):
    profile = current_user.student_profile
    if not profile:
        raise HTTPException(status_code=400, detail="No student profile found")
    return _compute_student_summary(db, profile.id)


@router.get("/my-records")
def my_attendance_records(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("student")),
):
    profile = current_user.student_profile
    if not profile:
        raise HTTPException(status_code=400, detail="No student profile found")
    records = (
        db.query(models.AttendanceRecord)
        .filter(models.AttendanceRecord.student_id == profile.id)
        .all()
    )
    records = sorted(records, key=lambda r: r.session.session_date, reverse=True)
    return [
        {
            "date": r.session.session_date.isoformat(),
            "subject": r.session.subject.name,
            "section": r.session.section,
            "status": r.status.value,
        }
        for r in records
    ]


@router.get("/student/{student_id}/summary", response_model=List[schemas.StudentAttendanceSummary])
def student_attendance_summary(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin", "hod", "faculty")),
):
    return _compute_student_summary(db, student_id)


def _compute_student_summary(db: Session, student_id: int) -> List[schemas.StudentAttendanceSummary]:
    records = (
        db.query(models.AttendanceRecord)
        .filter(models.AttendanceRecord.student_id == student_id)
        .all()
    )

    by_subject = defaultdict(lambda: {"total": 0, "present": 0, "name": ""})
    for r in records:
        subject = r.session.subject
        entry = by_subject[subject.id]
        entry["name"] = subject.name
        entry["total"] += 1
        if r.status.value == "present":
            entry["present"] += 1

    summary = []
    for subject_id, data in by_subject.items():
        pct = (data["present"] / data["total"] * 100) if data["total"] else 0
        summary.append(
            schemas.StudentAttendanceSummary(
                subject_id=subject_id,
                subject_name=data["name"],
                total_sessions=data["total"],
                present_count=data["present"],
                percentage=round(pct, 1),
            )
        )
    return summary


# ---------- Start Class flow (timetable-linked, webcam-based) ----------

@router.get("/live-slot", response_model=List[schemas.LiveSlotOut])
def get_live_slots(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("faculty", "hod")),
):
    """Today's timetable slots this faculty member should teach -- their own,
    plus any they're covering via an approved swap -- each flagged with
    whether it's happening right now, upcoming, or already past."""
    today = date.today()
    weekday = today.weekday()

    owned = (
        db.query(models.TimetableEntry)
        .filter(models.TimetableEntry.day_of_week == weekday)
        .filter(models.TimetableEntry.faculty_id == current_user.id)
        .all()
    )

    covering = (
        db.query(models.TimetableEntry)
        .join(models.SwapRequest, models.SwapRequest.timetable_entry_id == models.TimetableEntry.id)
        .filter(
            models.TimetableEntry.day_of_week == weekday,
            models.SwapRequest.target_faculty_id == current_user.id,
            models.SwapRequest.swap_date == today,
            models.SwapRequest.status == models.SwapStatus.approved,
        )
        .all()
    )
    covering_ids = {e.id for e in covering}

    # Drop owned slots that were swapped away to someone else today.
    visible_owned = []
    for entry in owned:
        effective = _effective_faculty_id(db, entry, today)
        if effective == current_user.id:
            visible_owned.append(entry)

    all_entries = visible_owned + [e for e in covering if e.id not in {x.id for x in visible_owned}]

    results = []
    for entry in all_entries:
        session = (
            db.query(models.AttendanceSession)
            .filter(
                models.AttendanceSession.timetable_entry_id == entry.id,
                models.AttendanceSession.session_date == today,
            )
            .first()
        )
        results.append(
            schemas.LiveSlotOut(
                timetable_entry_id=entry.id,
                subject_id=entry.subject.id,
                subject_name=entry.subject.name,
                section=entry.section,
                room=entry.room,
                start_time=entry.start_time,
                end_time=entry.end_time,
                status=_slot_status(entry.start_time, entry.end_time),
                is_swapped_in=entry.id in covering_ids,
                existing_session_id=session.id if session else None,
                existing_session_status=session.status.value if session else None,
            )
        )
    results.sort(key=lambda r: r.start_time)
    return results


@router.post("/sessions/start", response_model=schemas.SessionStartOut, status_code=status.HTTP_201_CREATED)
def start_class_session(
    payload: schemas.SessionStartRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("faculty", "hod")),
):
    entry = (
        db.query(models.TimetableEntry)
        .filter(models.TimetableEntry.id == payload.timetable_entry_id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Timetable entry not found")

    today = date.today()
    effective_faculty_id = _effective_faculty_id(db, entry, today)
    if effective_faculty_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="This slot isn't assigned to you today (check swap requests if you expected otherwise).",
        )

    return _start_or_get_session(db, entry, effective_faculty_id)


def _start_or_get_session(db: Session, entry: models.TimetableEntry, faculty_id: int) -> schemas.SessionStartOut:
    today = date.today()
    existing = (
        db.query(models.AttendanceSession)
        .filter(
            models.AttendanceSession.timetable_entry_id == entry.id,
            models.AttendanceSession.session_date == today,
        )
        .first()
    )
    roster = _section_roster(db, entry.section)

    if existing:
        if existing.status == models.SessionStatus.completed:
            raise HTTPException(status_code=400, detail="This class has already been completed today.")
        return schemas.SessionStartOut(
            session_id=existing.id,
            status=existing.status.value,
            subject_name=entry.subject.name,
            section=entry.section,
            roster_size=len(roster),
            room=entry.room,
            end_time=entry.end_time,
        )

    session = models.AttendanceSession(
        subject_id=entry.subject_id,
        faculty_id=faculty_id,
        section=entry.section,
        session_date=today,
        timetable_entry_id=entry.id,
        status=models.SessionStatus.live,
        started_at=datetime.utcnow(),
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return schemas.SessionStartOut(
        session_id=session.id,
        status=session.status.value,
        subject_name=entry.subject.name,
        section=entry.section,
        roster_size=len(roster),
        room=entry.room,
        end_time=entry.end_time,
    )


@router.post("/sessions/auto-start", response_model=schemas.SessionStartOut, status_code=status.HTTP_201_CREATED)
def auto_start_class_session(
    payload: schemas.SessionStartRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("faculty", "hod", "admin")),
):
    """
    Used by an unattended Classroom Kiosk page -- the device stays logged in
    (as an admin/HOD account, typically) and calls this itself once a room's
    attendance window opens. Unlike /sessions/start, the caller doesn't need
    to *be* the assigned faculty -- the session is opened under the
    timetable's real assigned faculty (or their approved swap-in) regardless
    of who/what is operating the kiosk, so reports go to the right inbox.
    """
    entry = (
        db.query(models.TimetableEntry)
        .filter(models.TimetableEntry.id == payload.timetable_entry_id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Timetable entry not found")
    today = date.today()
    effective_faculty_id = _effective_faculty_id(db, entry, today)
    return _start_or_get_session(db, entry, effective_faculty_id)


def _minutes_from_midnight(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def _hhmm(total_minutes: int) -> str:
    total_minutes = max(0, min(23 * 60 + 59, total_minutes))
    return f"{total_minutes // 60:02d}:{total_minutes % 60:02d}"


@router.get("/room-window", response_model=schemas.RoomWindowOut)
def get_room_window(
    room: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("faculty", "hod", "admin")),
):
    """
    Powers the Classroom Kiosk: given a room name, figures out whether a
    class is scheduled there right now, whether its automatic
    attendance-capture window (start-time + offset, for `window` minutes)
    is currently open, already in progress, or hasn't started yet -- so the
    kiosk page can decide, entirely on its own, when to switch the webcam on.
    """
    settings = get_settings(db)
    offset, window = settings.attendance_offset_minutes, settings.attendance_window_minutes

    today = date.today()
    weekday = today.weekday()
    now_min = _minutes_from_midnight(datetime.now().strftime("%H:%M"))

    entries = (
        db.query(models.TimetableEntry)
        .filter(models.TimetableEntry.room == room, models.TimetableEntry.day_of_week == weekday)
        .order_by(models.TimetableEntry.start_time)
        .all()
    )

    current_entry = None
    current_window = None
    next_entry = None

    for entry in entries:
        start_min = _minutes_from_midnight(entry.start_time)
        w_start, w_end = start_min + offset, start_min + offset + window
        if w_start <= now_min <= w_end:
            current_entry = entry
            current_window = (w_start, w_end)
            break
        if start_min > now_min and next_entry is None:
            next_entry = entry

    if current_entry is None:
        return schemas.RoomWindowOut(
            room=room, status="idle",
            next_start_time=next_entry.start_time if next_entry else None,
            next_subject_name=next_entry.subject.name if next_entry else None,
            offset_minutes=offset, window_minutes=window,
        )

    faculty_id = _effective_faculty_id(db, current_entry, today)
    faculty = db.query(models.User).filter(models.User.id == faculty_id).first()
    session = (
        db.query(models.AttendanceSession)
        .filter(
            models.AttendanceSession.timetable_entry_id == current_entry.id,
            models.AttendanceSession.session_date == today,
        )
        .first()
    )
    roster_size = len(_section_roster(db, current_entry.section))
    present_count = 0
    session_status = None
    session_id = None
    if session:
        session_id = session.id
        session_status = session.status.value
        present_count = sum(1 for r in session.records if r.status == models.AttendanceStatus.present)

    if session and session.status == models.SessionStatus.completed:
        rt_status = "just_completed"
    elif session and session.status == models.SessionStatus.live:
        rt_status = "in_progress"
    else:
        rt_status = "window_open"

    return schemas.RoomWindowOut(
        room=room, status=rt_status,
        timetable_entry_id=current_entry.id,
        subject_name=current_entry.subject.name,
        section=current_entry.section,
        faculty_name=faculty.name if faculty else "",
        start_time=current_entry.start_time,
        end_time=current_entry.end_time,
        window_start=_hhmm(current_window[0]),
        window_end=_hhmm(current_window[1]),
        session_id=session_id,
        session_status=session_status,
        present_count=present_count,
        roster_size=roster_size,
        offset_minutes=offset, window_minutes=window,
    )


def _can_operate_session(current_user: models.User, session: "models.AttendanceSession") -> bool:
    """The assigned faculty can always drive their own session. Admin can
    operate any session (kiosk devices commonly stay logged in as an admin
    account). HOD can operate sessions within their own department -- this
    covers a kiosk device logged in as the HOD, and normal HOD oversight."""
    if current_user.id == session.faculty_id:
        return True
    if current_user.role.value == "admin":
        return True
    if current_user.role.value == "hod":
        return session.faculty.department_id == current_user.department_id
    return False


@router.post("/sessions/{session_id}/capture", response_model=schemas.CaptureResult)
def capture_attendance_frame(
    session_id: int,
    payload: schemas.CaptureRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("faculty", "hod", "admin")),
):
    session = db.query(models.AttendanceSession).filter(models.AttendanceSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if not _can_operate_session(current_user, session):
        raise HTTPException(status_code=403, detail="Not your session")
    if session.status != models.SessionStatus.live:
        raise HTTPException(status_code=400, detail="This class session is not live")

    try:
        image_bgr = face_engine.decode_base64_image(payload.image)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image data")

    all_detections = face_engine.recognize_faces_all(image_bgr)

    roster = _section_roster(db, session.section)
    roster_by_profile_id = {u.student_profile.id: u for u in roster}
    already_present_ids = {
        r.student_id for r in session.records if r.status == models.AttendanceStatus.present
    }

    newly_matched = []
    detections_out = []

    for d in all_detections:
        sp_id = d["student_profile_id"]

        if not d["matched"]:
            detections_out.append(schemas.FaceDetection(
                box=d["box"], matched=False, confidence=0.0,
            ))
            continue

        user = None
        # A face can be recognized correctly but belong to a student not
        # enrolled in *this* section (wrong classroom) -- still show the
        # box with their name so it's obvious, but don't mark attendance.
        if sp_id in roster_by_profile_id:
            user = roster_by_profile_id[sp_id]
        else:
            any_user = (
                db.query(models.User)
                .join(models.StudentProfile)
                .filter(models.StudentProfile.id == sp_id)
                .first()
            )
            user = any_user

        detections_out.append(schemas.FaceDetection(
            box=d["box"],
            matched=True,
            student_id=sp_id,
            name=user.name if user else "Unknown",
            roll_no=user.student_profile.roll_no if user else "",
            confidence=d["confidence_pct"],
            in_roster=sp_id in roster_by_profile_id,
            liveness="n/a",
        ))
        current_detection = detections_out[-1]

        if sp_id not in roster_by_profile_id:
            continue  # recognized face isn't in this class's section -- don't mark present
        if sp_id in already_present_ids:
            current_detection.liveness = "confirmed"
            continue  # already marked, nothing new to do

        liveness = face_engine.check_liveness(session.id, sp_id, image_bgr, d["box"])
        current_detection.liveness = liveness["status"]
        if not liveness["confirmed"]:
            # Recognized, in this class's roster, but not yet proven live --
            # don't mark attendance off a single still frame (defends against
            # someone holding up a printed photo of a classmate).
            continue

        existing_record = next((r for r in session.records if r.student_id == sp_id), None)
        if existing_record:
            existing_record.status = models.AttendanceStatus.present
            existing_record.method = "face"
        else:
            db.add(models.AttendanceRecord(
                session_id=session.id,
                student_id=sp_id,
                status=models.AttendanceStatus.present,
                method="face",
            ))
        already_present_ids.add(sp_id)
        newly_matched.append(schemas.MatchedStudent(
            student_id=sp_id, name=user.name, roll_no=user.student_profile.roll_no
        ))

    db.commit()

    return schemas.CaptureResult(
        newly_matched=newly_matched,
        present_count=len(already_present_ids),
        roster_size=len(roster),
        faces_detected=len(all_detections),
        detections=detections_out,
        room=session.timetable_entry.room if session.timetable_entry else "",
    )


@router.post("/sessions/{session_id}/complete", response_model=schemas.SessionCompleteOut)
def complete_class_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("faculty", "hod", "admin")),
):
    session = db.query(models.AttendanceSession).filter(models.AttendanceSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if not _can_operate_session(current_user, session):
        raise HTTPException(status_code=403, detail="Not your session")

    roster = _section_roster(db, session.section)
    existing_record_student_ids = {r.student_id for r in session.records}

    for user in roster:
        sp_id = user.student_profile.id
        if sp_id not in existing_record_student_ids:
            db.add(models.AttendanceRecord(
                session_id=session.id,
                student_id=sp_id,
                status=models.AttendanceStatus.absent,
                method="auto",
            ))

    session.status = models.SessionStatus.completed
    session.ended_at = datetime.utcnow()
    db.commit()
    db.refresh(session)

    present_names = []
    absent_names = []
    present_students = []
    absent_students = []
    for user in roster:
        sp_id = user.student_profile.id
        record = next((r for r in session.records if r.student_id == sp_id), None)
        label = f"{user.name} ({user.student_profile.roll_no})"
        student_details = {
            "name": user.name,
            "roll_no": user.student_profile.roll_no,
            "department": user.department.code if user.department else "",
            "semester": "",
        }
        if record and record.status == models.AttendanceStatus.present:
            present_names.append(label)
            present_students.append(student_details)
        else:
            absent_names.append(label)
            absent_students.append(student_details)

    excel_attachment = build_attendance_workbook(
        subject_code=session.subject.code,
        subject_name=session.subject.name,
        faculty_name=session.faculty.name,
        department=session.faculty.department.code if session.faculty.department else "",
        section=session.section,
        session_date=session.session_date.isoformat(),
        present_students=present_students,
        absent_students=absent_students,
    )

    emailed = email_utils.send_attendance_report(
        to_email=session.faculty.email,
        faculty_name=session.faculty.name,
        subject_name=f"{session.subject.code} — {session.subject.name}",
        section=session.section,
        session_date=session.session_date.isoformat(),
        present_students=present_names,
        absent_students=absent_names,
        room=session.timetable_entry.room if session.timetable_entry else None,
        excel_attachment=excel_attachment,
    )
    session.report_emailed = emailed
    db.commit()
    face_engine.clear_liveness_state(session.id)

    if emailed:
        note = f"Report emailed to {session.faculty.email}."
    elif email_utils.is_configured():
        note = "Attendance saved, but the report email failed to send. Check backend logs."
    else:
        note = "Attendance saved. Email wasn't sent because SMTP isn't configured yet (see backend/.env.example)."

    return schemas.SessionCompleteOut(
        session_id=session.id,
        present_count=len(present_names),
        absent_count=len(absent_names),
        roster_size=len(roster),
        report_emailed=emailed,
        email_note=note,
    )


@router.get("/live-sessions", response_model=List[schemas.LiveSessionOut])
def list_live_sessions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin", "hod")),
):
    """Every class currently in progress right now, for the admin/HOD
    monitoring view (replaces the old CCTV placeholder)."""
    query = db.query(models.AttendanceSession).filter(
        models.AttendanceSession.status == models.SessionStatus.live
    )
    sessions = query.all()

    if current_user.role.value == "hod":
        sessions = [
            s for s in sessions
            if s.faculty.department_id == current_user.department_id
        ]

    results = []
    for s in sessions:
        present_count = sum(1 for r in s.records if r.status == models.AttendanceStatus.present)
        roster_size = len(_section_roster(db, s.section))
        results.append(schemas.LiveSessionOut(
            session_id=s.id,
            subject_name=s.subject.name,
            section=s.section,
            faculty_name=s.faculty.name,
            room=s.timetable_entry.room if s.timetable_entry else "",
            started_at=s.started_at,
            present_count=present_count,
            roster_size=roster_size,
        ))
    return results
