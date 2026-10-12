from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..core.deps import require_roles
from ..core.audit import log_action
from .attendance import get_settings

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=schemas.SystemSettingsOut)
def read_settings(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin", "hod", "faculty")),
):
    return get_settings(db)


@router.put("", response_model=schemas.SystemSettingsOut)
def update_settings(
    payload: schemas.SystemSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin")),
):
    settings = get_settings(db)
    updates = payload.dict(exclude_unset=True)
    for field, value in updates.items():
        setattr(settings, field, value)
    log_action(db, current_user, "settings.update", "system_settings", 1, str(updates))
    db.commit()
    db.refresh(settings)
    return settings
