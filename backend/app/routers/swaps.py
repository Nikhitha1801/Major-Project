from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..core.deps import require_roles
from ..core.audit import log_action
from ..core import email_utils

router = APIRouter(prefix="/swap-requests", tags=["swap-requests"])


def _to_out(sr: models.SwapRequest) -> schemas.SwapRequestOut:
    entry = sr.timetable_entry
    return schemas.SwapRequestOut(
        id=sr.id,
        timetable_entry_id=sr.timetable_entry_id,
        subject_name=entry.subject.name,
        section=entry.section,
        day_of_week=entry.day_of_week,
        start_time=entry.start_time,
        end_time=entry.end_time,
        requesting_faculty_id=sr.requesting_faculty_id,
        requesting_faculty_name=sr.requesting_faculty.name,
        target_faculty_id=sr.target_faculty_id,
        target_faculty_name=sr.target_faculty.name if sr.target_faculty else None,
        swap_date=sr.swap_date,
        reason=sr.reason,
        status=sr.status.value,
        created_at=sr.created_at,
        decided_at=sr.decided_at,
    )


@router.post("", response_model=schemas.SwapRequestOut, status_code=status.HTTP_201_CREATED)
def create_swap_request(
    payload: schemas.SwapRequestCreate,
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
    if entry.faculty_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only request a swap for your own class")

    if payload.target_faculty_id:
        target = db.query(models.User).filter(models.User.id == payload.target_faculty_id).first()
        if not target or target.role.value not in ("faculty", "hod"):
            raise HTTPException(status_code=400, detail="Target faculty not found")

    sr = models.SwapRequest(
        timetable_entry_id=payload.timetable_entry_id,
        requesting_faculty_id=current_user.id,
        target_faculty_id=payload.target_faculty_id,
        swap_date=payload.swap_date,
        reason=payload.reason,
        status=models.SwapStatus.pending,
    )
    db.add(sr)
    db.commit()
    db.refresh(sr)
    if payload.target_faculty_id:
        email_utils.send_swap_request_email(
            to_email=target.email,
            target_name=target.name,
            requester_name=current_user.name,
            subject_code=entry.subject.code,
            subject_name=entry.subject.name,
            section=entry.section,
            swap_date=sr.swap_date.isoformat(),
            start_time=entry.start_time,
            end_time=entry.end_time,
            reason=sr.reason,
        )
    return _to_out(sr)


@router.get("", response_model=List[schemas.SwapRequestOut])
def list_swap_requests(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("faculty", "hod", "admin")),
):
    query = db.query(models.SwapRequest)

    if current_user.role.value == "faculty":
        query = query.filter(
            (models.SwapRequest.requesting_faculty_id == current_user.id)
            | (models.SwapRequest.target_faculty_id == current_user.id)
        )
    elif current_user.role.value == "hod":
        # HOD sees every swap request from faculty in their own department
        dept_faculty_ids = [
            u.id for u in db.query(models.User).filter(
                models.User.department_id == current_user.department_id
            )
        ]
        query = query.filter(models.SwapRequest.requesting_faculty_id.in_(dept_faculty_ids))

    if status_filter:
        query = query.filter(models.SwapRequest.status == status_filter)

    requests = query.order_by(models.SwapRequest.created_at.desc()).all()
    return [_to_out(sr) for sr in requests]


@router.patch("/{request_id}", response_model=schemas.SwapRequestOut)
def decide_swap_request(
    request_id: int,
    payload: schemas.SwapDecisionRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("faculty", "hod", "admin")),
):
    sr = db.query(models.SwapRequest).filter(models.SwapRequest.id == request_id).first()
    if not sr:
        raise HTTPException(status_code=404, detail="Swap request not found")
    if sr.status != models.SwapStatus.pending:
        raise HTTPException(status_code=400, detail="This request has already been decided")

    is_hod_or_admin = current_user.role.value in ("hod", "admin")
    # A plain faculty member may only decide a request that's already
    # addressed to them specifically -- they can't self-assign to someone
    # else's open request, and they can't decide other people's requests.
    is_addressed_target = (
        current_user.role.value == "faculty"
        and sr.target_faculty_id == current_user.id
    )

    if not (is_hod_or_admin or is_addressed_target):
        raise HTTPException(
            status_code=403,
            detail="Only the covering faculty this request is addressed to, or an HOD/admin, can decide it.",
        )

    if payload.target_faculty_id:
        if not is_hod_or_admin:
            raise HTTPException(
                status_code=403,
                detail="Only an HOD or admin can assign a different covering faculty.",
            )
        target = db.query(models.User).filter(models.User.id == payload.target_faculty_id).first()
        if not target or target.role.value not in ("faculty", "hod"):
            raise HTTPException(status_code=400, detail="Target faculty not found")
        sr.target_faculty_id = payload.target_faculty_id

    if payload.approve and not sr.target_faculty_id:
        raise HTTPException(
            status_code=400,
            detail="Assign a covering faculty before approving this request.",
        )

    sr.status = models.SwapStatus.approved if payload.approve else models.SwapStatus.rejected
    sr.decided_by_id = current_user.id
    sr.decided_at = datetime.utcnow()
    log_action(
        db, current_user,
        action=f"swap.{sr.status.value}",
        target_type="swap_request", target_id=sr.id,
        detail=f"{sr.timetable_entry.subject.name} · {sr.swap_date.isoformat()} · requested by {sr.requesting_faculty.name}",
    )
    db.commit()
    db.refresh(sr)
    email_utils.send_swap_decision_email(
        to_email=sr.requesting_faculty.email,
        requester_name=sr.requesting_faculty.name,
        decision=sr.status.value,
        deciding_name=current_user.name,
        subject_code=sr.timetable_entry.subject.code,
        subject_name=sr.timetable_entry.subject.name,
        section=sr.timetable_entry.section,
        swap_date=sr.swap_date.isoformat(),
    )
    return _to_out(sr)
