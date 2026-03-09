import uuid
from collections import defaultdict
from typing import Annotated
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from app.auth import get_current_user_optional
from app.database import get_db, audit_log_insert
from app.services import qdrant_client
from app.storage import save_upload
from app.services.face_embedding import extract_embeddings_from_bytes

router = APIRouter()


def _aggregate_scores(candidate_scores: dict) -> list:
    """Aggregate by reference_person_id: max score. Returns sorted list of (ref_id, score)."""
    by_ref = defaultdict(list)
    for ref_id, score in candidate_scores:
        by_ref[ref_id].append(score)
    aggregated = [(ref_id, max(scores)) for ref_id, scores in by_ref.items()]
    return sorted(aggregated, key=lambda x: -x[1])


def _run_match_impl(submission_id: str, audit_user_id: str | None = None):
    with get_db() as conn:
        row = conn.execute("SELECT id FROM submissions WHERE id = ?", (submission_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Submission not found")
    # Get all vectors for this submission (multi-angle)
    points = qdrant_client.get_vectors_by_submission(submission_id)
    if not points:
        return {"submission_id": submission_id, "matches": [], "message": "No face embeddings found for this submission."}
    candidate_scores = []
    seen_refs = set()
    for p in points:
        vector = p["vector"]
        if isinstance(vector, list):
            import numpy as np
            vector = np.array(vector, dtype=np.float32)
        results = qdrant_client.search_reference_only(vector, limit=15)
        for r in results:
            ref_id = (r.get("payload") or {}).get("reference_person_id")
            if ref_id and r.get("score") is not None:
                candidate_scores.append((ref_id, r["score"]))
                seen_refs.add(ref_id)
    aggregated = _aggregate_scores(candidate_scores)
    # Load reference_persons for labels
    with get_db() as conn:
        refs = {}
        for ref_id, _ in aggregated[:20]:
            row = conn.execute("SELECT id, label, photo_path, attributes FROM reference_persons WHERE id = ?", (ref_id,)).fetchone()
            if row:
                refs[ref_id] = {"id": row["id"], "label": row["label"], "photo_path": row["photo_path"], "attributes": row["attributes"]}
    matches = []
    for rank, (ref_id, score) in enumerate(aggregated[:20], 1):
        match_id = str(uuid.uuid4())
        ref_info = refs.get(ref_id) or {"id": ref_id, "label": ref_id, "photo_path": None, "attributes": None}
        with get_db() as conn:
            conn.execute(
                "INSERT INTO matches (id, submission_id, reference_person_id, overall_score, face_score, rank, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (match_id, submission_id, ref_id, score, score, rank, "pending_review"),
            )
            audit_log_insert(conn, "match.run", "match", match_id, user_id=audit_user_id)
        matches.append({
            "match_id": match_id,
            "rank": rank,
            "reference_person_id": ref_id,
            "label": ref_info["label"],
            "photo_path": ref_info["photo_path"],
            "scores": {"overall": score, "face": score},
            "attributes": ref_info["attributes"],
        })
    return {"submission_id": submission_id, "matches": matches}


@router.post("/submissions/{submission_id}/match")
def run_match(
    submission_id: str,
    current_user: Annotated[dict | None, Depends(get_current_user_optional)] = None,
):
    return _run_match_impl(submission_id, audit_user_id=current_user["id"] if current_user else None)


@router.post("/upload-and-match")
async def upload_and_match(
    files: list[UploadFile] = File(...),
    image_types: str = Form(default='["face_frontal"]'),
    current_user: Annotated[dict | None, Depends(get_current_user_optional)] = None,
):
    import json
    try:
        image_types_list = json.loads(image_types) if image_types else []
    except json.JSONDecodeError:
        image_types_list = ["face_frontal"] * len(files)
    if not files:
        raise HTTPException(400, "At least one image required")
    if len(image_types_list) < len(files):
        image_types_list.extend(["face_frontal"] * (len(files) - len(image_types_list)))
    submission_id = str(uuid.uuid4())
    # Read file contents (UploadFile is consumed after read)
    file_contents = [await f.read() for f in files]
    from app.storage import save_upload
    from app.services.face_embedding import extract_embeddings_from_bytes
    images = []
    all_points = []
    for i, (content, img_type) in enumerate(zip(file_contents, image_types_list[: len(files)])):
        ext = (files[i].filename or "jpg").split(".")[-1].lower() or "jpg"
        rel_path = save_upload(content, submission_id, img_type, ext)
        image_id = str(uuid.uuid4())
        embeddings = extract_embeddings_from_bytes(content, img_type)
        point_ids = []
        for emb, conf in embeddings:
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
    if all_points:
        qdrant_client.upsert_points(all_points)
    with get_db() as conn:
        conn.execute(
            "INSERT INTO submissions (id, attributes_ai, attributes_manual, face_condition) VALUES (?, ?, ?, ?)",
            (submission_id, "{}", "{}", "normal"),
        )
        for im in images:
            conn.execute(
                "INSERT INTO images (id, submission_id, image_type, path, embedding_confidence, qdrant_point_id) VALUES (?, ?, ?, ?, ?, ?)",
                (im["id"], im["submission_id"], im["image_type"], im["path"], im.get("embedding_confidence"), im.get("qdrant_point_id")),
            )
        audit_log_insert(conn, "submission.create", "submission", submission_id, user_id=current_user["id"] if current_user else None)
    # Run match
    response = _run_match_impl(submission_id, audit_user_id=current_user["id"] if current_user else None)
    return response
