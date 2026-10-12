from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..core.deps import get_current_user, require_roles
from ..core.audit import log_action

router = APIRouter(prefix="/departments", tags=["departments"])


@router.get("", response_model=List[schemas.DepartmentOut])
def list_departments(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return db.query(models.Department).all()


@router.post("", response_model=schemas.DepartmentOut, status_code=status.HTTP_201_CREATED)
def create_department(
    payload: schemas.DepartmentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin")),
):
    existing = db.query(models.Department).filter(models.Department.code == payload.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Department code already exists")
    dept = models.Department(name=payload.name, code=payload.code)
    db.add(dept)
    db.flush()
    log_action(db, current_user, "department.create", "department", dept.id, f"{dept.code} · {dept.name}")
    db.commit()
    db.refresh(dept)
    return dept


@router.put("/{department_id}", response_model=schemas.DepartmentOut)
def update_department(
    department_id: int,
    payload: schemas.DepartmentUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin")),
):
    dept = db.query(models.Department).filter(models.Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    updates = payload.dict(exclude_unset=True)
    if "code" in updates and updates["code"] != dept.code:
        clash = db.query(models.Department).filter(models.Department.code == updates["code"]).first()
        if clash:
            raise HTTPException(status_code=400, detail="Department code already exists")
    for field, value in updates.items():
        setattr(dept, field, value)
    log_action(db, current_user, "department.update", "department", dept.id, f"{dept.code} · {dept.name}")
    db.commit()
    db.refresh(dept)
    return dept


@router.delete("/{department_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_department(
    department_id: int,
    force: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin")),
):
    dept = db.query(models.Department).filter(models.Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")

    user_count = db.query(models.User).filter(models.User.department_id == department_id).count()
    subject_count = db.query(models.Subject).filter(models.Subject.department_id == department_id).count()
    if (user_count or subject_count) and not force:
        raise HTTPException(
            status_code=400,
            detail=f"This department has {user_count} user(s) and {subject_count} subject(s) attached. "
                   f"Reassign or remove those first, or resend with force=true to unassign them and delete anyway.",
        )

    if force:
        db.query(models.User).filter(models.User.department_id == department_id).update({"department_id": None})
        # Subjects require a department (non-nullable) -- can't be force-unassigned,
        # so force-deleting the department deletes its subjects too (and, via the
        # subject-delete cascade rules, anything scheduled under them).
        for subject in db.query(models.Subject).filter(models.Subject.department_id == department_id):
            entry_ids = [e.id for e in db.query(models.TimetableEntry.id).filter(models.TimetableEntry.subject_id == subject.id)]
            session_ids = [s.id for s in db.query(models.AttendanceSession.id).filter(models.AttendanceSession.subject_id == subject.id)]
            if session_ids:
                db.query(models.AttendanceRecord).filter(models.AttendanceRecord.session_id.in_(session_ids)).delete(synchronize_session=False)
                db.query(models.AttendanceSession).filter(models.AttendanceSession.id.in_(session_ids)).delete(synchronize_session=False)
            db.query(models.SwapRequest).filter(models.SwapRequest.timetable_entry_id.in_(entry_ids)).delete(synchronize_session=False)
            db.query(models.TimetableEntry).filter(models.TimetableEntry.subject_id == subject.id).delete(synchronize_session=False)
            db.delete(subject)

    log_action(
        db, current_user, "department.delete", "department", dept.id,
        f"{dept.code} · {dept.name}" + (f" (force: unassigned {user_count} user(s), removed {subject_count} subject(s))" if force else ""),
    )
    db.delete(dept)
    db.commit()
    return None
