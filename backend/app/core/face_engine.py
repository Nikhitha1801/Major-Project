"""
Face detection + recognition for multi-student classroom frames.

Pipeline (all ONNX, runs on CPU via onnxruntime -- no GPU, no C++ build tools):
  - Detection:   SCRFD (det_500m, from InsightFace "buffalo_s"). Finds every
                 face in the frame at once, with 5 facial landmarks each.
  - Alignment:   similarity-transform each face to the canonical 112x112
                 ArcFace template using those landmarks.
  - Embedding:   MobileFaceNet trained with ArcFace loss (w600k_mbf) -> a
                 512-d unit vector per face.
  - Matching:    cosine similarity against each registered student's stored
                 embeddings. A face is only accepted when it clears BOTH an
                 absolute similarity threshold AND a margin over the
                 runner-up student, which is what keeps look-alikes and
                 strangers from being mis-recognized.

Model files ship in backend/face_model/models/. Registered face crops live in
backend/face_uploads/<student_profile_id>/ and the embedding gallery is
rebuilt from them by train_recognizer().
"""
import base64
import json
import os
from typing import List, Optional, Tuple

import cv2
import numpy as np
import onnxruntime as ort

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FACE_UPLOAD_DIR = os.path.join(BASE_DIR, "face_uploads")
MODEL_DIR = os.path.join(BASE_DIR, "face_model")
ONNX_DIR = os.path.join(MODEL_DIR, "models")
DET_MODEL_PATH = os.path.join(ONNX_DIR, "det_500m.onnx")
REC_MODEL_PATH = os.path.join(ONNX_DIR, "w600k_mbf.onnx")
GALLERY_PATH = os.path.join(MODEL_DIR, "gallery.npz")
LABELS_PATH = os.path.join(MODEL_DIR, "labels.json")

os.makedirs(FACE_UPLOAD_DIR, exist_ok=True)
os.makedirs(MODEL_DIR, exist_ok=True)

EYE_CASCADE = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_eye.xml")
FACE_SIZE = (200, 200)  # only used by the liveness heuristic's face crops

# --- Tunables -------------------------------------------------------------
DET_SCORE_THRESHOLD = 0.5     # SCRFD confidence to call something a face
DET_NMS_THRESHOLD = 0.4
DET_MAX_SIDE = 1920           # preserve 1080p detail for small classroom faces
MIN_FACE_PIXELS = 24          # ignore detections smaller than this (too tiny to identify)
# Cosine similarity for w600k_mbf: same person is typically 0.5-0.8, different
# people 0.0-0.3. 0.45 + a margin keeps false accepts very low.
MATCH_THRESHOLD = 0.45
MATCH_MARGIN = 0.06           # best student must beat the runner-up by this much

_ARCFACE_TEMPLATE = np.array([
    [38.2946, 51.6963], [73.5318, 51.5014], [56.0252, 71.7366],
    [41.5493, 92.3655], [70.7299, 92.2041],
], dtype=np.float32)

_det_session = None
_rec_session = None
_gallery_cache = {"mtime": None, "ids": None, "embs": None, "owner": None}


def _sessions():
    global _det_session, _rec_session
    if _det_session is None:
        if not (os.path.exists(DET_MODEL_PATH) and os.path.exists(REC_MODEL_PATH)):
            raise RuntimeError(
                f"Face models missing. Expected det_500m.onnx and w600k_mbf.onnx in {ONNX_DIR}"
            )
        opts = ort.SessionOptions()
        opts.log_severity_level = 3
        providers = ["CPUExecutionProvider"]
        _det_session = ort.InferenceSession(DET_MODEL_PATH, opts, providers=providers)
        _rec_session = ort.InferenceSession(REC_MODEL_PATH, opts, providers=providers)
    return _det_session, _rec_session


# ---------------------------------------------------------------------------
# Detection (SCRFD)
# ---------------------------------------------------------------------------
def _distance2bbox(points, distance):
    return np.stack([
        points[:, 0] - distance[:, 0], points[:, 1] - distance[:, 1],
        points[:, 0] + distance[:, 2], points[:, 1] + distance[:, 3],
    ], axis=-1)


def _distance2kps(points, distance):
    out = []
    for i in range(0, distance.shape[1], 2):
        out.append(points[:, 0] + distance[:, i])
        out.append(points[:, 1] + distance[:, i + 1])
    return np.stack(out, axis=-1)


def _nms(dets, thresh):
    x1, y1, x2, y2, scores = dets[:, 0], dets[:, 1], dets[:, 2], dets[:, 3], dets[:, 4]
    areas = (x2 - x1 + 1) * (y2 - y1 + 1)
    order = scores.argsort()[::-1]
    keep = []
    while order.size > 0:
        i = order[0]
        keep.append(i)
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])
        inter = np.maximum(0.0, xx2 - xx1 + 1) * np.maximum(0.0, yy2 - yy1 + 1)
        iou = inter / (areas[i] + areas[order[1:]] - inter)
        order = order[np.where(iou <= thresh)[0] + 1]
    return keep


def detect_faces(image_bgr: np.ndarray) -> List[dict]:
    """Every face in the frame: {box:[x,y,w,h], score, kps:5x2} in original pixel coords."""
    det, _ = _sessions()
    h0, w0 = image_bgr.shape[:2]

    scale = min(1.0, DET_MAX_SIDE / float(max(h0, w0)))
    img = cv2.resize(image_bgr, (int(w0 * scale), int(h0 * scale))) if scale < 1.0 else image_bgr
    h, w = img.shape[:2]
    # pad bottom/right to a multiple of 32 (the network's largest stride)
    ph, pw = (h + 31) // 32 * 32, (w + 31) // 32 * 32
    canvas = np.zeros((ph, pw, 3), dtype=np.uint8)
    canvas[:h, :w] = img

    blob = cv2.dnn.blobFromImage(canvas, 1.0 / 128, (pw, ph), (127.5, 127.5, 127.5), swapRB=True)
    outs = det.run(None, {det.get_inputs()[0].name: blob})

    fmc, strides = 3, (8, 16, 32)
    scores_l, bboxes_l, kps_l = [], [], []
    for idx, stride in enumerate(strides):
        scores = outs[idx][:, 0] if outs[idx].ndim == 2 else outs[idx].reshape(-1)
        bbox_preds = outs[idx + fmc].reshape(-1, 4) * stride
        kps_preds = outs[idx + fmc * 2].reshape(-1, 10) * stride
        gh, gw = ph // stride, pw // stride
        centers = np.stack(np.mgrid[:gh, :gw][::-1], axis=-1).astype(np.float32)
        centers = (centers * stride).reshape(-1, 2)
        centers = np.stack([centers] * 2, axis=1).reshape(-1, 2)  # 2 anchors per cell
        keep = np.where(scores >= DET_SCORE_THRESHOLD)[0]
        if keep.size == 0:
            continue
        scores_l.append(scores[keep])
        bboxes_l.append(_distance2bbox(centers, bbox_preds)[keep])
        kps_l.append(_distance2kps(centers, kps_preds)[keep].reshape(-1, 5, 2))

    if not scores_l:
        return []
    scores = np.concatenate(scores_l)
    bboxes = np.concatenate(bboxes_l)
    kps = np.concatenate(kps_l)
    dets = np.hstack([bboxes, scores[:, None]]).astype(np.float32)
    keep = _nms(dets, DET_NMS_THRESHOLD)

    faces = []
    for i in keep:
        x1, y1, x2, y2 = (bboxes[i] / scale)
        x1, y1 = max(0.0, x1), max(0.0, y1)
        x2, y2 = min(float(w0), x2), min(float(h0), y2)
        bw, bh = x2 - x1, y2 - y1
        if bw < MIN_FACE_PIXELS or bh < MIN_FACE_PIXELS:
            continue
        faces.append({
            "box": [int(x1), int(y1), int(bw), int(bh)],
            "score": float(scores[i]),
            "kps": (kps[i] / scale).astype(np.float32),
        })
    faces.sort(key=lambda f: f["box"][0])  # left-to-right, stable ordering
    return faces


# ---------------------------------------------------------------------------
# Alignment + embedding (MobileFaceNet / ArcFace)
# ---------------------------------------------------------------------------
def _umeyama(src: np.ndarray, dst: np.ndarray) -> np.ndarray:
    """Least-squares similarity transform (2x3) mapping src -> dst."""
    n = src.shape[0]
    mu_s, mu_d = src.mean(0), dst.mean(0)
    sc, dc = src - mu_s, dst - mu_d
    var_s = (sc ** 2).sum() / n
    cov = dc.T @ sc / n
    U, S, Vt = np.linalg.svd(cov)
    d = np.ones(2)
    if np.linalg.det(cov) < 0:
        d[-1] = -1
    R = U @ np.diag(d) @ Vt
    scale = (S * d).sum() / var_s
    t = mu_d - scale * R @ mu_s
    return np.hstack([scale * R, t[:, None]]).astype(np.float32)


def align_face(image_bgr: np.ndarray, kps: np.ndarray) -> np.ndarray:
    M = _umeyama(kps.astype(np.float32), _ARCFACE_TEMPLATE)
    return cv2.warpAffine(image_bgr, M, (112, 112), borderValue=0)


def embed_aligned(aligned_bgr_list: List[np.ndarray]) -> np.ndarray:
    """Unit-length 512-d embeddings for a batch of aligned 112x112 BGR crops."""
    _, rec = _sessions()
    blob = cv2.dnn.blobFromImages(aligned_bgr_list, 1.0 / 127.5, (112, 112), (127.5, 127.5, 127.5), swapRB=True)
    embs = rec.run(None, {rec.get_inputs()[0].name: blob})[0]
    embs = embs / np.maximum(np.linalg.norm(embs, axis=1, keepdims=True), 1e-9)
    return embs.astype(np.float32)


# ---------------------------------------------------------------------------
# Image helpers + legacy-compatible helpers used by routers / liveness
# ---------------------------------------------------------------------------
def decode_base64_image(data_url: str) -> np.ndarray:
    header_split = data_url.split(",", 1)
    encoded = header_split[1] if len(header_split) == 2 else header_split[0]
    binary = np.frombuffer(base64.b64decode(encoded), dtype=np.uint8)
    image = cv2.imdecode(binary, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Could not decode image")
    return image


def detect_largest_face(image_bgr: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
    faces = detect_faces(image_bgr)
    if not faces:
        return None
    best = max(faces, key=lambda f: f["box"][2] * f["box"][3])
    return tuple(best["box"])


def detect_all_faces(image_bgr: np.ndarray) -> List[Tuple[int, int, int, int]]:
    return [tuple(f["box"]) for f in detect_faces(image_bgr)]


def crop_face_gray(image_bgr: np.ndarray, box) -> np.ndarray:
    x, y, w, h = [int(v) for v in box]
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    face = gray[max(0, y):y + h, max(0, x):x + w]
    if face.size == 0:
        face = np.zeros(FACE_SIZE, dtype=np.uint8)
    face = cv2.resize(face, FACE_SIZE)
    return cv2.equalizeHist(face)


# ---------------------------------------------------------------------------
# Registration + gallery
# ---------------------------------------------------------------------------
def enroll_face(student_profile_id: int, index: int, image_bgr: np.ndarray) -> bool:
    """Detect the largest face, store its aligned 112x112 crop. False if no face."""
    faces = detect_faces(image_bgr)
    if not faces:
        return False
    best = max(faces, key=lambda f: f["box"][2] * f["box"][3])
    aligned = align_face(image_bgr, best["kps"])
    student_dir = os.path.join(FACE_UPLOAD_DIR, str(student_profile_id))
    if index == 0:  # fresh registration replaces any older samples
        for f in os.listdir(student_dir) if os.path.isdir(student_dir) else []:
            if f.lower().endswith(".png"):
                os.remove(os.path.join(student_dir, f))
    os.makedirs(student_dir, exist_ok=True)
    cv2.imwrite(os.path.join(student_dir, f"face_{index}.png"), aligned)
    return True


def train_recognizer() -> dict:
    """Rebuilds the embedding gallery from every stored crop. Cheap (a few ms per image)."""
    ids, embs = [], []
    if os.path.isdir(FACE_UPLOAD_DIR):
        for name in sorted(os.listdir(FACE_UPLOAD_DIR)):
            sdir = os.path.join(FACE_UPLOAD_DIR, name)
            try:
                sid = int(name)
            except ValueError:
                continue
            if not os.path.isdir(sdir):
                continue
            crops = []
            for fname in sorted(os.listdir(sdir)):
                if not fname.lower().endswith(".png"):
                    continue
                img = cv2.imread(os.path.join(sdir, fname), cv2.IMREAD_COLOR)
                if img is None:
                    continue
                if img.shape[:2] != (112, 112):
                    img = cv2.resize(img, (112, 112))
                crops.append(img)
            if crops:
                e = embed_aligned(crops)
                embs.append(e)
                ids.extend([sid] * len(e))

    if not ids:
        for p in (GALLERY_PATH, LABELS_PATH):
            if os.path.exists(p):
                os.remove(p)
        _gallery_cache.update(mtime=None, ids=None, embs=None)
        return {"trained_students": 0, "trained_images": 0}

    all_embs = np.concatenate(embs)
    np.savez(GALLERY_PATH, ids=np.array(ids, dtype=np.int64), embs=all_embs)
    with open(LABELS_PATH, "w") as f:
        json.dump({"students": sorted(set(ids))}, f)
    _gallery_cache.update(mtime=None)  # force reload on next recognition
    return {"trained_students": len(set(ids)), "trained_images": len(ids)}


def _load_gallery():
    if not os.path.exists(GALLERY_PATH):
        return None, None
    mtime = os.path.getmtime(GALLERY_PATH)
    if _gallery_cache["mtime"] != mtime:
        data = np.load(GALLERY_PATH)
        _gallery_cache.update(mtime=mtime, ids=data["ids"], embs=data["embs"])
    return _gallery_cache["ids"], _gallery_cache["embs"]


def _similarity_to_confidence_pct(sim: float) -> float:
    # 0.45 (accept threshold) -> ~50%, 0.75+ -> ~100%
    return round(float(min(100.0, max(0.0, 50.0 + (sim - MATCH_THRESHOLD) / 0.30 * 50.0))), 1)


def recognize_faces(image_bgr: np.ndarray) -> List[dict]:
    return [d for d in recognize_faces_all(image_bgr) if d["matched"]]


def recognize_faces_all(image_bgr: np.ndarray) -> List[dict]:
    """
    One entry per detected face. Matched entries carry student_profile_id and
    confidence_pct; everything else is matched=False ("Unknown"), so a person
    who isn't registered is never forced onto the nearest enrolled student.
    """
    faces = detect_faces(image_bgr)
    if not faces:
        return []

    gallery_ids, gallery_embs = _load_gallery()
    aligned = [align_face(image_bgr, f["kps"]) for f in faces]
    embs = embed_aligned(aligned)

    results = []
    for f, emb in zip(faces, embs):
        entry = {
            "box": f["box"], "matched": False, "student_profile_id": None,
            "distance": None, "confidence_pct": 0.0, "det_score": round(f["score"], 3),
        }
        if gallery_ids is not None:
            sims = gallery_embs @ emb
            # best similarity per student
            per_student = {}
            for sid, s in zip(gallery_ids, sims):
                if s > per_student.get(int(sid), -1.0):
                    per_student[int(sid)] = float(s)
            ranked = sorted(per_student.items(), key=lambda kv: kv[1], reverse=True)
            best_id, best_sim = ranked[0]
            runner_up = ranked[1][1] if len(ranked) > 1 else -1.0
            if best_sim >= MATCH_THRESHOLD and (best_sim - runner_up) >= MATCH_MARGIN:
                entry.update(matched=True, student_profile_id=best_id,
                             distance=round(1.0 - best_sim, 3),
                             confidence_pct=_similarity_to_confidence_pct(best_sim))
        results.append(entry)
    return results


# ---------------------------------------------------------------------------
# Liveness heuristic (anti-photo-spoof)
# A face showing neither a blink-like eye-state change nor natural
# micro-movement across several capture cycles is flagged as a probable photo
# and is NOT marked present. A deterrent against a still printed photo, not a
# guarantee -- a video replayed on a phone can still pass.
# ---------------------------------------------------------------------------
LIVENESS_MOTION_THRESHOLD = 4.0   # mean abs pixel diff (0-255) considered natural movement
LIVENESS_CONFIRM_AFTER = 2        # capture cycles showing a live signal before confirming present
LIVENESS_SUSPECT_AFTER = 6        # cycles with zero live signal at all before flagging as a probable photo

# In-memory per-session liveness tracking, keyed by (session_id, student_profile_id).
# Deliberately not persisted to the DB -- a class session is short-lived, and
# clear_liveness_state() is called when a session completes.
_liveness_state: dict = {}


def check_liveness(session_id: int, student_profile_id: int, image_bgr: np.ndarray, box) -> dict:
    """
    Per-FACE liveness. Each recognized student can have several tracks (one per
    distinct on-screen face location), so a student's real face and, say, a
    printed photo of them are judged independently instead of being compared
    against each other. The student counts as live if ANY of their tracks
    shows a live signal.
    """
    key = (session_id, student_profile_id)
    x, y, w, h = [int(v) for v in box]
    cx, cy, size = x + w / 2.0, y + h / 2.0, float(max(w, h))
    face_small = cv2.resize(crop_face_gray(image_bgr, box), (80, 80))
    eyes_detected = len(EYE_CASCADE.detectMultiScale(face_small, scaleFactor=1.1, minNeighbors=6, minSize=(12, 12))) >= 1

    tracks = _liveness_state.setdefault(key, {"confirmed": False, "tracks": []})
    if tracks["confirmed"]:
        return {"confirmed": True, "status": "confirmed"}

    # find this face's own track by position (it may drift a little between cycles)
    track = None
    best = size * 0.75
    for t in tracks["tracks"]:
        d = ((t["cx"] - cx) ** 2 + (t["cy"] - cy) ** 2) ** 0.5
        if d < best:
            best, track = d, t
    if track is None:
        tracks["tracks"].append({"cx": cx, "cy": cy, "last_face": face_small, "last_eyes": eyes_detected,
                                 "live_hits": 0, "checks": 0})
        return {"confirmed": False, "status": "verifying"}

    motion_score = float(np.mean(cv2.absdiff(face_small, track["last_face"])))
    live_signal = (eyes_detected != track["last_eyes"]) or motion_score > LIVENESS_MOTION_THRESHOLD
    track["checks"] += 1
    if live_signal:
        track["live_hits"] += 1
    track.update(cx=cx, cy=cy, last_face=face_small, last_eyes=eyes_detected)

    if track["live_hits"] >= LIVENESS_CONFIRM_AFTER:
        tracks["confirmed"] = True
        return {"confirmed": True, "status": "confirmed"}
    if track["checks"] >= LIVENESS_SUSPECT_AFTER and track["live_hits"] == 0:
        return {"confirmed": False, "status": "suspected_photo"}
    return {"confirmed": False, "status": "verifying"}


def clear_liveness_state(session_id: int) -> None:
    for key in [k for k in _liveness_state if k[0] == session_id]:
        del _liveness_state[key]


