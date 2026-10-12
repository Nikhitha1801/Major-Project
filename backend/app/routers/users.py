import os
import shutil
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..core.deps import get_current_user, require_roles
from ..core.security import hash_password
from ..core.audit import log_action
from ..core.face_engine import FACE_UPLOAD_DIR, train_recognizer

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=List[schemas.UserOut])
def list_users(
    role: Optional[str] = None,
    department_id: Optional[int] = None,
    section: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin", "hod", "faculty")),
):
    query = db.query(models.User)
    if role:
        query = query.filter(models.User.role == role)
    if department_id:
        query = query.filter(models.User.department_id == department_id)
    # HOD is scoped to their own department
    if current_user.role.value == "hod":
        query = query.filter(models.User.department_id == current_user.department_id)
    users = query.all()
    if section:
        users = [
            u for u in users
            if u.student_profile and u.student_profile.section == section
        ]
    return users


@router.post("", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: schemas.UserCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin")),
):
    """
    Creates a new user. If an account already exists with this email --
    or, for students, this roll number -- the old account (and its
    profile, attendance history, and registered face data) is deleted
    first and replaced with the new one. This is a deliberate "fresh
    start" behavior for re-adding someone rather than an error, so admin
    doesn't have to manually delete-then-recreate every time.
    """
    replaced_note = None

    existing_by_email = db.query(models.User).filter(models.User.email == payload.email).first()
    existing_by_roll = None
    if payload.role == "student" and payload.roll_no:
        existing_by_roll = (
            db.query(models.User)
            .join(models.StudentProfile)
            .filter(models.StudentProfile.roll_no == payload.roll_no)
            .first()
        )

    for old_user in {u.id: u for u in (existing_by_email, existing_by_roll) if u}.values():
        replaced_note = f"replaced existing user #{old_user.id} ({old_user.email})"
        if old_user.student_profile:
            # Wipe any registered face images on disk too -- otherwise the
            # old face crops would keep training the recognizer under a
            # profile id that no longer maps to anyone real.
            student_dir = os.path.join(FACE_UPLOAD_DIR, str(old_user.student_profile.id))
            shutil.rmtree(student_dir, ignore_errors=True)
            # Attendance records aren't a cascade relationship (a student's
            # history is meant to survive normal edits) -- but since we're
            # deliberately replacing this person's account entirely, clear
            # their old records too so nothing orphaned lingers in reports.
            db.query(models.AttendanceRecord).filter(
                models.AttendanceRecord.student_id == old_user.student_profile.id
            ).delete()
        log_action(db, current_user, "user.delete", "user", old_user.id, f"{old_user.name} ({old_user.role.value}) -- superseded by new entry")
        db.delete(old_user)
    if replaced_note:
        db.flush()

    user = models.User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        department_id=payload.department_id,
    )
    db.add(user)
    db.flush()

    if payload.role == "student":
        if not payload.roll_no:
            raise HTTPException(status_code=400, detail="roll_no is required for students")
        profile = models.StudentProfile(
            user_id=user.id,
            roll_no=payload.roll_no,
            section=payload.section or "A",
            year=payload.year or 1,
        )
        db.add(profile)
    elif payload.role in ("faculty", "hod"):
        profile = models.FacultyProfile(
            user_id=user.id,
            designation=payload.designation or "Assistant Professor",
        )
        db.add(profile)

    log_action(
        db, current_user, "user.create", "user", user.id,
        f"{user.name} ({payload.role})" + (f" -- {replaced_note}" if replaced_note else ""),
    )
    db.commit()
    db.refresh(user)

    if replaced_note and payload.role == "student":
        # A student's face crops were just deleted above -- retrain so the
        # recognizer doesn't keep matching frames against a now-removed profile.
        train_recognizer()

    return user


@router.put("/{user_id}", response_model=schemas.UserOut)
def update_user(
    user_id: int,
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin")),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.email and payload.email != user.email:
        clash = db.query(models.User).filter(models.User.email == payload.email, models.User.id != user_id).first()
        if clash:
            raise HTTPException(status_code=400, detail="Another user already has this email")
        user.email = payload.email
    if payload.name:
        user.name = payload.name
    if payload.password:
        user.password_hash = hash_password(payload.password)
    if payload.department_id is not None:
        user.department_id = payload.department_id

    if user.student_profile:
        if payload.roll_no and payload.roll_no != user.student_profile.roll_no:
            clash = (
                db.query(models.StudentProfile)
                .filter(models.StudentProfile.roll_no == payload.roll_no, models.StudentProfile.user_id != user_id)
                .first()
            )
            if clash:
                raise HTTPException(status_code=400, detail="Another student already has this roll number")
            user.student_profile.roll_no = payload.roll_no
        if payload.section is not None:
            user.student_profile.section = payload.section
        if payload.year is not None:
            user.student_profile.year = payload.year
    elif user.faculty_profile and payload.designation is not None:
        user.faculty_profile.designation = payload.designation

    log_action(db, current_user, "user.update", "user", user.id, f"{user.name} ({payload.dict(exclude_unset=True, exclude={'password'}).keys()})")
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin")),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    student_profile_id = user.student_profile.id if user.student_profile else None
    if student_profile_id is not None:
        db.query(models.AttendanceRecord).filter(
            models.AttendanceRecord.student_id == student_profile_id
        ).delete(synchronize_session=False)

    log_action(db, current_user, "user.delete", "user", user.id, f"{user.name} ({user.role.value})")
    db.delete(user)
    db.commit()

    if student_profile_id is not None:
        student_dir = os.path.join(FACE_UPLOAD_DIR, str(student_profile_id))
        shutil.rmtree(student_dir, ignore_errors=True)
        train_recognizer()

    return None


@router.get("/{user_id}", response_model=schemas.UserOut)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
