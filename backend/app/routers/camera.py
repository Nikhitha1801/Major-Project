from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from ..core.deps import require_roles
from ..core.ip_camera import read_snapshot

router = APIRouter(prefix="/camera", tags=["camera"])


class CameraFrameRequest(BaseModel):
    url: str


@router.post("/frame")
def camera_frame(
    payload: CameraFrameRequest,
    current_user=Depends(require_roles("admin", "hod", "faculty")),
):
    try:
        jpeg = read_snapshot(payload.url)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return Response(
        content=jpeg,
        media_type="image/jpeg",
        headers={"Cache-Control": "no-store"},
    )