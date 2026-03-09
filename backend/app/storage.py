import uuid
import shutil
from pathlib import Path
from app.config import SUBMISSIONS_STORAGE_PATH


def save_upload(file_content: bytes, submission_id: str, image_type: str, ext: str = "jpg") -> str:
    """Save uploaded file under submissions/{submission_id}/{image_type}_{uuid}.{ext}. Returns relative path."""
    sub_dir = SUBMISSIONS_STORAGE_PATH / submission_id
    sub_dir.mkdir(parents=True, exist_ok=True)
    name = f"{image_type}_{uuid.uuid4().hex[:12]}.{ext}"
    path = sub_dir / name
    path.write_bytes(file_content)
    return f"{submission_id}/{name}"


def get_full_path(relative_path: str) -> Path:
    return SUBMISSIONS_STORAGE_PATH / relative_path


def get_url_path(relative_path: str) -> str:
    """Path for serving file (e.g. /api/files/...)."""
    return f"/api/files/{relative_path}"
