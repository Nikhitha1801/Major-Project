from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..core.deps import require_roles

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])


@router.get("", response_model=List[schemas.AuditLogOut])
def list_audit_logs(
    action: Optional[str] = None,
    limit: int = 200,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin")),
):
    query = db.query(models.AuditLog)
    if action:
        query = query.filter(models.AuditLog.action.like(f"{action}%"))
    return (
        query.order_by(models.AuditLog.created_at.desc())
        .limit(min(limit, 1000))
        .all()
    )
