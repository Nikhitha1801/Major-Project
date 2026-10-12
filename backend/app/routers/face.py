"""
Face registration + recognition endpoints.

Registration: each captured angle is run through the SCRFD face detector,
aligned to a 112x112 crop and saved. After all angles are saved, the
MobileFaceNet embedding gallery is rebuilt across every registered student so
live recognition picks up the new student immediately.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..core.deps import require_roles
from ..core import face_engine

router = APIRouter(prefix="/face", tags=["face"])


class FaceRegisterRequest(BaseModel):
    images: List[str]  # base64-encoded data URLs, one per captured angle


@router.post("/register")
def register_face(
    payload: FaceRegisterRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("student")),
):
    profile = current_user.student_profile
    if not profile:
        raise HTTPException(status_code=400, detail="No student profile found")

    if len(payload.images) < 3:
        raise HTTPException(status_code=400, detail="Please capture at least 3 angles")

    saved = 0
    no_face_count = 0
    for idx, image_data in enumerate(payload.images):
        try:
            image_bgr = face_engine.decode_base64_image(image_data)
        except Exception:
            raise HTTPException(status_code=400, detail=f"Invalid image data at index {idx}")

        if face_engine.enroll_face(profile.id, saved, image_bgr):
            saved += 1
        else:
            no_face_count += 1

    if saved == 0:
        raise HTTPException(
            status_code=400,
            detail="No face was detected in any of the captured images. "
                   "Make sure your face is well-lit and centered, then try again.",
        )

    summary = face_engine.train_recognizer()

    profile.face_registered = True
    db.commit()

    return {
        "status": "ok",
        "face_registered": True,
        "images_saved": saved,
        "images_skipped_no_face": no_face_count,
        "model_trained_students": summary["trained_students"],
    }


@router.get("/status")
def face_status(
    current_user: models.User = Depends(require_roles("student")),
):
    profile = current_user.student_profile
    return {"face_registered": bool(profile and profile.face_registered)}
