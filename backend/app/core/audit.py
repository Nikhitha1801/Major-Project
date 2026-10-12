"""
Shared helper for writing audit log entries. Call from within a router
right before (or after) db.commit() of the action being logged; this
function itself does not commit -- callers should commit once, together
with their own change, to keep everything in one transaction.
"""
from typing import Optional
from sqlalchemy.orm import Session

from .. import models


def log_action(
    db: Session,
    actor: Optional[models.User],
    action: str,
    target_type: str = "",
    target_id: Optional[int] = None,
    detail: str = "",
) -> None:
    entry = models.AuditLog(
        actor_id=actor.id if actor else None,
        actor_name=actor.name if actor else "system",
        actor_role=actor.role.value if actor else "system",
        action=action,
        target_type=target_type,
        target_id=target_id,
        detail=detail,
    )
    db.add(entry)
