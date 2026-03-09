import uuid
import json
from typing import Annotated
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from app.auth import get_current_user_optional
from app.database import get_db, audit_log_insert
from app.storage import save_upload
from app.services.face_embedding import extract_embeddings_from_bytes
from app.services import qdrant_client

router = APIRouter()


def process_images(submission_id: str, files: list, image_types: list):
    """Save files, run face embedding per image, upsert to Qdrant. Returns list of image records. files are UploadFile."""
    images = []
    all_points = []
    for f, img_type in zip(files, image_types):
        content = f.file.read()
        ext = (f.filename or "jpg").split(".")[-1].lower() or "jpg"
        rel_path = save_upload(content, submission_id, img_type, ext)
        image_id = str(uuid.uuid4())
        embeddings = extract_embeddings_from_bytes(content, img_type)
        point_ids = []
        for i, (emb, conf) in enumerate(embeddings):
            point_id = str(uuid.uuid4())
            point_ids.append(point_id)
            all_points.append({
                "id": point_id,
                "vector": emb,
                "payload": {
                    "submission_id": submission_id,
                    "image_id": image_id,
                    "image_type": img_type,
                    "is_missing_person": False,
                    "embedding_confidence": conf,
                },
            })
        qdrant_point_id = point_ids[0] if point_ids else None
        images.append({
            "id": image_id,
            "submission_id": submission_id,
            "image_type": img_type,
            "path": rel_path,
            "embedding_confidence": embeddings[0][1] if embeddings else None,
            "qdrant_point_id": qdrant_point_id,
        })
        if len(point_ids) > 1:
            for pid in point_ids[1:]:
                idx = next(i for i, p in enumerate(all_points) if p["id"] == pid)
                all_points[idx]["payload"]["image_id"] = image_id
        # already added first; rest are already in all_points
    if all_points:
        qdrant_client.upsert_points(all_points)
    return images


@router.post("/submissions")
async def create_submission(
    files: list[UploadFile] = File(...),
    image_types: str = Form(default="[]"),  # JSON array of strings
    attributes_ai: str = Form(default="{}"),
    attributes_manual: str = Form(default="{}"),
    face_condition: str = Form(default="normal"),
    current_user: Annotated[dict | None, Depends(get_current_user_optional)] = None,
):
    try:
        image_types_list = json.loads(image_types) if image_types else []
    except json.JSONDecodeError:
        image_types_list = ["face_frontal"] * len(files)
    if len(files) != len(image_types_list):
        raise HTTPException(400, "files and image_types length must match")
    submission_id = str(uuid.uuid4())
    try:
        att_ai = json.loads(attributes_ai) if attributes_ai else {}
        att_man = json.loads(attributes_manual) if attributes_manual else {}
    except json.JSONDecodeError:
        att_ai, att_man = {}, {}
    images = process_images(submission_id, files, image_types_list)
    with get_db() as conn:
        conn.execute(
            "INSERT INTO submissions (id, attributes_ai, attributes_manual, face_condition) VALUES (?, ?, ?, ?)",
            (submission_id, json.dumps(att_ai), json.dumps(att_man), face_condition),
        )
        for im in images:
            conn.execute(
                "INSERT INTO images (id, submission_id, image_type, path, embedding_confidence, qdrant_point_id) VALUES (?, ?, ?, ?, ?, ?)",
                (im["id"], im["submission_id"], im["image_type"], im["path"], im.get("embedding_confidence"), im.get("qdrant_point_id")),
            )
        audit_log_insert(conn, "submission.create", "submission", submission_id, user_id=current_user["id"] if current_user else None)
    return {"submission_id": submission_id, "images": [{"id": im["id"], "image_type": im["image_type"], "path": im["path"]} for im in images]}


@router.get("/submissions")
def list_submissions():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT s.id, s.created_at, s.status, (SELECT path FROM images WHERE submission_id = s.id LIMIT 1) as first_image_path FROM submissions s ORDER BY s.created_at DESC LIMIT 100"
        ).fetchall()
    return [{"id": row["id"], "created_at": row["created_at"], "status": row["status"], "first_image_path": row["first_image_path"]} for row in rows]


@router.get("/submissions/{submission_id}")
def get_submission(submission_id: str):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM submissions WHERE id = ?", (submission_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Submission not found")
        images = conn.execute("SELECT id, image_type, path, embedding_confidence FROM images WHERE submission_id = ?", (submission_id,)).fetchall()
    return {
        "id": row["id"],
        "created_at": row["created_at"],
        "attributes_ai": json.loads(row["attributes_ai"] or "{}"),
        "attributes_manual": json.loads(row["attributes_manual"] or "{}"),
        "face_condition": row["face_condition"],
        "status": row["status"],
        "images": [{"id": r["id"], "image_type": r["image_type"], "path": r["path"], "embedding_confidence": r["embedding_confidence"]} for r in images],
    }
