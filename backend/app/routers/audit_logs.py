from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from .. import models
from ..database import get_db
from ..core.deps import require_roles

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])


class AuditLogOut(BaseModel):
    id: int
    actor_name: str
    action: str
    description: str
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("", response_model=List[AuditLogOut])
def list_audit_logs(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin")),
):
    return (
        db.query(models.AuditLog)
        .order_by(models.AuditLog.created_at.desc())
        .limit(min(limit, 500))
        .all()
    )
