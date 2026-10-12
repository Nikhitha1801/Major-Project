import csv
import io
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..core.deps import get_current_user, require_roles
from ..core.audit import log_action

router = APIRouter(tags=["academics"])

DAY_NAME_TO_INDEX = {
    "mon": 0, "monday": 0, "tue": 1, "tuesday": 1, "wed": 2, "wednesday": 2,
    "thu": 3, "thursday": 3, "fri": 4, "friday": 4, "sat": 5, "saturday": 5,
    "sun": 6, "sunday": 6,
}


@router.get("/subjects", response_model=List[schemas.SubjectOut])
def list_subjects(
    department_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Subject)
    if department_id:
        query = query.filter(models.Subject.department_id == department_id)
    return query.all()


@router.post("/subjects", response_model=schemas.SubjectOut, status_code=status.HTTP_201_CREATED)
def create_subject(
    payload: schemas.SubjectCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin", "hod")),
):
    existing = db.query(models.Subject).filter(models.Subject.code == payload.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Subject code already exists")
    dept = db.query(models.Department).filter(models.Department.id == payload.department_id).first()
    if not dept:
        raise HTTPException(status_code=400, detail="Department not found")
    subject = models.Subject(
        name=payload.name, code=payload.code,
        department_id=payload.department_id, semester=payload.semester,
    )
    db.add(subject)
    db.flush()
    log_action(db, current_user, "subject.create", "subject", subject.id, f"{subject.code} · {subject.name}")
    db.commit()
    db.refresh(subject)
    return subject


@router.put("/subjects/{subject_id}", response_model=schemas.SubjectOut)
def update_subject(
    subject_id: int,
    payload: schemas.SubjectUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin", "hod")),
):
    subject = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    updates = payload.dict(exclude_unset=True)
    if "code" in updates and updates["code"] != subject.code:
        clash = db.query(models.Subject).filter(models.Subject.code == updates["code"]).first()
        if clash:
            raise HTTPException(status_code=400, detail="Subject code already exists")
    for field, value in updates.items():
        setattr(subject, field, value)
    log_action(db, current_user, "subject.update", "subject", subject.id, f"{subject.code} · {subject.name}")
    db.commit()
    db.refresh(subject)
    return subject


@router.delete("/subjects/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subject(
    subject_id: int,
    force: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin", "hod")),
):
    subject = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    entry_count = db.query(models.TimetableEntry).filter(models.TimetableEntry.subject_id == subject_id).count()
    if entry_count and not force:
        raise HTTPException(
            status_code=400,
            detail=f"This subject is used in {entry_count} timetable slot(s). "
                   f"Remove those slots first, or resend with force=true to delete them along with the subject.",
        )

    if entry_count:
        entry_ids = [e.id for e in db.query(models.TimetableEntry.id).filter(models.TimetableEntry.subject_id == subject_id)]
        session_ids = [s.id for s in db.query(models.AttendanceSession.id).filter(models.AttendanceSession.subject_id == subject_id)]
        if session_ids:
            db.query(models.AttendanceRecord).filter(models.AttendanceRecord.session_id.in_(session_ids)).delete(synchronize_session=False)
            db.query(models.AttendanceSession).filter(models.AttendanceSession.id.in_(session_ids)).delete(synchronize_session=False)
        db.query(models.SwapRequest).filter(models.SwapRequest.timetable_entry_id.in_(entry_ids)).delete(synchronize_session=False)
        db.query(models.TimetableEntry).filter(models.TimetableEntry.subject_id == subject_id).delete(synchronize_session=False)

    log_action(
        db, current_user, "subject.delete", "subject", subject.id,
        f"{subject.code} · {subject.name}" + (f" (force-deleted {entry_count} timetable slot(s))" if entry_count else ""),
    )
    db.delete(subject)
    db.commit()
    return None


@router.get("/timetable", response_model=List[schemas.TimetableEntryOut])
def list_timetable(
    faculty_id: Optional[int] = None,
    section: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.TimetableEntry)
    if faculty_id:
        query = query.filter(models.TimetableEntry.faculty_id == faculty_id)
    if section:
        query = query.filter(models.TimetableEntry.section == section)
    # Faculty by default only sees their own timetable unless filtering explicitly
    if current_user.role.value == "faculty" and faculty_id is None:
        query = query.filter(models.TimetableEntry.faculty_id == current_user.id)
    return query.all()


@router.post("/timetable", response_model=schemas.TimetableEntryOut, status_code=status.HTTP_201_CREATED)
def create_timetable_entry(
    subject_id: int,
    faculty_id: int,
    section: str,
    day_of_week: int,
    start_time: str,
    end_time: str,
    room: str = "",
    semester: int = 1,
    academic_year: str = "",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin", "hod")),
):
    entry = models.TimetableEntry(
        subject_id=subject_id,
        faculty_id=faculty_id,
        section=section,
        day_of_week=day_of_week,
        start_time=start_time,
        end_time=end_time,
        room=room,
        semester=semester,
        academic_year=academic_year,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.put("/timetable/{entry_id}", response_model=schemas.TimetableEntryOut)
def update_timetable_entry(
    entry_id: int,
    payload: schemas.TimetableEntryUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin", "hod")),
):
    entry = db.query(models.TimetableEntry).filter(models.TimetableEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Timetable entry not found")
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(entry, field, value)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/timetable/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_timetable_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin", "hod")),
):
    entry = db.query(models.TimetableEntry).filter(models.TimetableEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Timetable entry not found")
    db.delete(entry)
    db.commit()
    return None


@router.post("/timetable/bulk-upload", response_model=schemas.TimetableUploadResult)
def bulk_upload_timetable(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin")),
):
    """
    Bulk-import timetable slots from a CSV, used both to lay out a class's
    full weekly schedule and, since each row assigns a faculty_id, to
    populate that faculty member's own "My Timetable" view at the same
    time -- one upload builds both.

    Expected header row (case-insensitive):
      subject_code, faculty_email, section, day_of_week, start_time,
      end_time, room, semester, academic_year

    day_of_week accepts either 0-6 (Mon=0) or a day name (Mon/Monday/etc).
    """
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a .csv file")

    raw = file.file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Could not read file as UTF-8 text")

    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise HTTPException(status_code=400, detail="CSV appears to be empty")
    normalized_fields = {f.strip().lower(): f for f in reader.fieldnames}
    required = ["subject_code", "faculty_email", "section", "day_of_week", "start_time", "end_time"]
    missing = [f for f in required if f not in normalized_fields]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"CSV is missing required column(s): {', '.join(missing)}",
        )

    rows_out = []
    created = 0
    failed = 0

    for i, raw_row in enumerate(reader, start=2):  # row 1 is the header
        row = {k.strip().lower(): (v or "").strip() for k, v in raw_row.items()}
        try:
            subject = db.query(models.Subject).filter(models.Subject.code == row["subject_code"]).first()
            if not subject:
                raise ValueError(f"Unknown subject_code '{row['subject_code']}'")

            faculty = db.query(models.User).filter(models.User.email == row["faculty_email"]).first()
            if not faculty or faculty.role.value not in ("faculty", "hod"):
                raise ValueError(f"Unknown faculty_email '{row['faculty_email']}'")

            day_raw = row["day_of_week"]
            if day_raw.lower() in DAY_NAME_TO_INDEX:
                day_of_week = DAY_NAME_TO_INDEX[day_raw.lower()]
            else:
                day_of_week = int(day_raw)
            if not (0 <= day_of_week <= 6):
                raise ValueError("day_of_week must be 0-6 or a day name")

            entry = models.TimetableEntry(
                subject_id=subject.id,
                faculty_id=faculty.id,
                section=row["section"] or "A",
                day_of_week=day_of_week,
                start_time=row["start_time"],
                end_time=row["end_time"],
                room=row.get("room", ""),
                semester=int(row["semester"]) if row.get("semester") else 1,
                academic_year=row.get("academic_year", ""),
            )
            db.add(entry)
            created += 1
            rows_out.append(schemas.TimetableUploadRow(row=i, ok=True, message=f"{subject.code} · {faculty.name}"))
        except Exception as exc:  # noqa: BLE001 -- surfaced per-row to the admin
            failed += 1
            rows_out.append(schemas.TimetableUploadRow(row=i, ok=False, message=str(exc)))

    log_action(
        db, current_user, "timetable.bulk_upload", "timetable_entry",
        detail=f"{created} created, {failed} failed from {file.filename}",
    )
    db.commit()

    return schemas.TimetableUploadResult(created=created, failed=failed, rows=rows_out)


@router.post("/academics/new-semester", response_model=schemas.NewSemesterResult)
def start_new_semester(
    payload: schemas.NewSemesterRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin")),
):
    """
    Clears the entire timetable and every attendance session/record so the
    new semester starts from a blank schedule with every student at 0%
    attendance. Users, departments, subjects, and face registrations are
    left untouched. Requires payload.confirm == true as a safety check.
    """
    if not payload.confirm:
        raise HTTPException(
            status_code=400,
            detail="Set confirm=true to proceed. This clears the timetable and all attendance history.",
        )

    record_count = db.query(models.AttendanceRecord).count()
    session_count = db.query(models.AttendanceSession).count()
    entry_count = db.query(models.TimetableEntry).count()

    db.query(models.AttendanceRecord).delete()
    db.query(models.AttendanceSession).delete()
    db.query(models.SwapRequest).delete()
    db.query(models.TimetableEntry).delete()
    log_action(
        db, current_user, "academics.new_semester", "semester",
        detail=f"Semester {payload.semester} · {payload.academic_year} -- cleared "
               f"{entry_count} timetable entries, {session_count} sessions, {record_count} records",
    )
    db.commit()

    return schemas.NewSemesterResult(
        cleared_timetable_entries=entry_count,
        cleared_attendance_sessions=session_count,
        cleared_attendance_records=record_count,
        semester=payload.semester,
        academic_year=payload.academic_year,
    )
