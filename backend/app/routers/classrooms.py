from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..core.deps import get_current_user, require_roles
from ..core.audit import log_action

router = APIRouter(prefix="/classrooms", tags=["classrooms"])


@router.get("", response_model=List[schemas.ClassroomOut])
def list_classrooms(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return db.query(models.Classroom).order_by(models.Classroom.name).all()


@router.post("", response_model=schemas.ClassroomOut, status_code=status.HTTP_201_CREATED)
def create_classroom(
    payload: schemas.ClassroomCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin")),
):
    existing = db.query(models.Classroom).filter(models.Classroom.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="A classroom with this name already exists")
    room = models.Classroom(**payload.dict())
    db.add(room)
    db.flush()
    log_action(db, current_user, "classroom.create", "classroom", room.id, room.name)
    db.commit()
    db.refresh(room)
    return room


@router.put("/{classroom_id}", response_model=schemas.ClassroomOut)
def update_classroom(
    classroom_id: int,
    payload: schemas.ClassroomUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin")),
):
    room = db.query(models.Classroom).filter(models.Classroom.id == classroom_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Classroom not found")
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(room, field, value)
    log_action(db, current_user, "classroom.update", "classroom", room.id, room.name)
    db.commit()
    db.refresh(room)
    return room


@router.delete("/{classroom_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_classroom(
    classroom_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin")),
):
    room = db.query(models.Classroom).filter(models.Classroom.id == classroom_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Classroom not found")
    log_action(db, current_user, "classroom.delete", "classroom", room.id, room.name)
    db.delete(room)
    db.commit()
    return None
