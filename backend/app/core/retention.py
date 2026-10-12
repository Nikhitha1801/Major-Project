"""
Storage for attendance-session webcam captures, plus the 30-day auto-purge
that keeps disk usage bounded. This is the "prototype" version of what a
real CCTV integration would eventually need at much larger scale -- same
retention policy (delete after 30 days), just applied to individual webcam
frames instead of continuous video streams.
"""
import os
import base64
import logging

import cv2
import numpy as np
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from .. import models

logger = logging.getLogger("attendify.retention")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SESSION_PHOTO_DIR = os.path.join(BASE_DIR, "session_photos")
os.makedirs(SESSION_PHOTO_DIR, exist_ok=True)

RETENTION_DAYS = 30


def save_session_photo(db: Session, session_id: int, image_data_url: str, faces_detected: int) -> "models.SessionPhoto":
    """Writes one captured frame to disk under session_photos/{session_id}/
    and records it in the DB so it can be found and purged later."""
    session_dir = os.path.join(SESSION_PHOTO_DIR, str(session_id))
    os.makedirs(session_dir, exist_ok=True)

    header_split = image_data_url.split(",", 1)
    encoded = header_split[1] if len(header_split) == 2 else header_split[0]
    raw = base64.b64decode(encoded)
    # Frames now arrive in HD for multi-face recognition. Evidence photos don't
    # need that: shrink to <=960px wide at JPEG quality 70 (~10x smaller), so
    # 30 days of retention stays at roughly a gigabyte instead of tens of GB.
    try:
        img = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
        if img is not None:
            if img.shape[1] > 960:
                scale = 960.0 / img.shape[1]
                img = cv2.resize(img, (960, int(img.shape[0] * scale)), interpolation=cv2.INTER_AREA)
            ok, buf = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
            if ok:
                raw = buf.tobytes()
    except Exception:
        pass  # fall back to storing the original bytes

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
    filename = f"{timestamp}.jpg"
    path = os.path.join(session_dir, filename)
    with open(path, "wb") as f:
        f.write(raw)

    photo = models.SessionPhoto(
        session_id=session_id,
        file_path=path,
        faces_detected=faces_detected,
    )
    db.add(photo)
    return photo


def purge_expired_photos(db: Session) -> dict:
    """Deletes every SessionPhoto (file + DB row) older than RETENTION_DAYS.
    Safe to call repeatedly -- rows/files that are already gone are skipped."""
    cutoff = datetime.utcnow() - timedelta(days=RETENTION_DAYS)
    expired = db.query(models.SessionPhoto).filter(models.SessionPhoto.captured_at < cutoff).all()

    removed = 0
    for photo in expired:
        try:
            if os.path.exists(photo.file_path):
                os.remove(photo.file_path)
        except OSError as e:
            logger.warning("Could not remove session photo file %s: %s", photo.file_path, e)
        db.delete(photo)
        removed += 1

    if removed:
        db.commit()
        logger.info("Purged %d session photo(s) older than %d days.", removed, RETENTION_DAYS)

    # Clean up now-empty per-session directories.
    if os.path.isdir(SESSION_PHOTO_DIR):
        for session_dir_name in os.listdir(SESSION_PHOTO_DIR):
            session_dir = os.path.join(SESSION_PHOTO_DIR, session_dir_name)
            if os.path.isdir(session_dir) and not os.listdir(session_dir):
                os.rmdir(session_dir)

    return {"removed": removed, "cutoff": cutoff.isoformat()}
