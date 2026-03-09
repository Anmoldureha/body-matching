"""
Local face detection and embedding. Uses InsightFace when available; fallback for demo.
All models run locally (no cloud).
"""
import hashlib
import numpy as np
from pathlib import Path
from typing import List, Tuple, Optional

from app.config import EMBEDDING_DIM

# Optional: try insightface (pip install insightface onnxruntime)
try:
    import cv2
    from insightface.app import FaceAnalysis
    _INSIGHTFACE_AVAILABLE = True
except Exception:
    _INSIGHTFACE_AVAILABLE = False
    cv2 = None
    FaceAnalysis = None

_app: Optional[object] = None


def _get_app():
    global _app
    if _app is None and _INSIGHTFACE_AVAILABLE:
        try:
            _app = FaceAnalysis(name="buffalo_l", root=str(Path(__file__).resolve().parents[2]), allowed_modules=["detection", "recognition"])
            _app.prepare(ctx_id=0, det_thresh=0.3, det_size=(640, 640))  # lower threshold for partial/degraded
        except Exception:
            pass
    return _app


def _placeholder_embedding(image_bytes: bytes, image_type: str) -> np.ndarray:
    """Deterministic 512-d vector from image hash for demo when InsightFace not available."""
    h = hashlib.sha256(image_bytes).digest()
    np.random.seed(int.from_bytes(h[:4], "big"))
    return np.random.randn(EMBEDDING_DIM).astype(np.float32) * 0.1 + np.frombuffer(h * (EMBEDDING_DIM // 32 + 1), dtype=np.uint8)[:EMBEDDING_DIM].astype(np.float32) / 255.0


def extract_face_embeddings(image_path: Path, image_type: str = "face_frontal") -> List[Tuple[np.ndarray, float]]:
    """
    Extract face embeddings from an image. Returns list of (embedding, confidence).
    For degraded/partial faces we use lower confidence threshold.
    """
    image_bytes = image_path.read_bytes()
    app = _get_app()
    if app is None or cv2 is None:
        emb = _placeholder_embedding(image_bytes, image_type)
        return [(emb, 0.5)]

    img = cv2.imread(str(image_path))
    if img is None:
        return []
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    faces = app.get(rgb)  # det_thresh set in prepare() (0.3 for partial/degraded)
    result = []
    for face in faces:
        if hasattr(face, "embedding") and face.embedding is not None:
            conf = float(getattr(face, "det_score", 0.5))
            result.append((face.embedding.astype(np.float32), conf))
    if not result:
        # no face detected - return placeholder so we still have a vector for attribute-only flow
        result.append((_placeholder_embedding(image_bytes, image_type), 0.0))
    return result


def extract_embeddings_from_bytes(image_bytes: bytes, image_type: str = "face_frontal") -> List[Tuple[np.ndarray, float]]:
    """Extract embeddings from in-memory image bytes."""
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
        f.write(image_bytes)
        path = Path(f.name)
    try:
        return extract_face_embeddings(path, image_type)
    finally:
        path.unlink(missing_ok=True)
