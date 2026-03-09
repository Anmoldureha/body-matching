import json
import re
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.database import get_db

router = APIRouter()


def parse_query_to_filters(query: str) -> dict:
    """Simple local keyword extraction: male/female, tattoo on X, age, etc."""
    q = (query or "").lower().strip()
    filters = {}
    if "male" in q or "man" in q:
        filters["gender"] = "male"
    if "female" in q or "woman" in q:
        filters["gender"] = "female"
    if "tattoo" in q:
        filters["has_tattoo"] = True
        for part in ["neck", "arm", "right arm", "left arm", "chest", "back", "hand", "face"]:
            if part in q:
                filters["tattoo_location"] = part.replace(" ", "_")
                break
    if "mark" in q or "scar" in q:
        filters["has_marks"] = True
    return filters


@router.post("/search")
def search_by_query(body: dict):
    query = body.get("query") or body.get("q") or ""
    filters = parse_query_to_filters(query)
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, label, photo_path, attributes FROM reference_persons ORDER BY created_at DESC"
        ).fetchall()
    results = []
    for r in rows:
        att = json.loads(r["attributes"] or "{}") if isinstance(r["attributes"], str) else (r["attributes"] or {})
        if isinstance(att, str):
            att = json.loads(att) if att else {}
        match_score = 0.0
        if not filters:
            match_score = 0.5
        else:
            if filters.get("gender") and str(att.get("gender", "")).lower() == str(filters["gender"]).lower():
                match_score += 0.4
            if filters.get("has_tattoo") and ("tattoo" in str(att.get("visible_marks", "")).lower() or "tattoo" in str(att).lower()):
                match_score += 0.3
            if filters.get("tattoo_location") and filters["tattoo_location"].replace("_", " ") in str(att).lower():
                match_score += 0.2
            if filters.get("has_marks") and ("mark" in str(att).lower() or "scar" in str(att).lower()):
                match_score += 0.2
        if match_score > 0 or not filters:
            results.append({"id": r["id"], "label": r["label"], "photo_path": r["photo_path"], "attributes": att, "match_score": max(match_score, 0.3)})
    results.sort(key=lambda x: -x["match_score"])
    return {"query": query, "filters": filters, "shortlist": results[:30]}


@router.post("/search/voice")
async def search_by_voice(audio: UploadFile = File(...)):
    """STT (local Whisper) then same attribute search."""
    content = await audio.read()
    if not content:
        raise HTTPException(400, "No audio data")
    transcript = ""
    try:
        from faster_whisper import WhisperModel
        model = WhisperModel("base", device="cpu", compute_type="int8")
        segments, _ = model.transcribe(content, language="en")
        transcript = " ".join(s.text for s in segments).strip()
    except Exception as e:
        transcript = f"[STT unavailable: {e}]"
    if not transcript:
        return {"transcript": "", "shortlist": [], "query": "", "filters": {}}
    out = search_by_query({"query": transcript})
    out["transcript"] = transcript
    return out


def _refs_from_image_matches(matches: list) -> dict:
    """Return dict ref_id -> { label, photo_path, score }."""
    out = {}
    for m in matches:
        ref_id = m.get("reference_person_id")
        if not ref_id:
            continue
        score = (m.get("scores") or {}).get("overall") or (m.get("scores") or {}).get("face") or 0
        out[ref_id] = {"label": m.get("label"), "photo_path": m.get("photo_path"), "score": score}
    return out


def _refs_from_shortlist(shortlist: list) -> dict:
    """Return dict ref_id -> { label, photo_path, score }."""
    return {r["id"]: {"label": r.get("label"), "photo_path": r.get("photo_path"), "score": r.get("match_score", 0)} for r in shortlist}


@router.post("/search/combined")
async def search_combined(
    submission_id: str = Form(default=""),
    query: str = Form(default=""),
    audio: Optional[UploadFile] = File(default=None),
    files: Optional[list[UploadFile]] = File(default=None),
):
    """
    Run image (submission or upload), text, and/or voice search together.
    Merge results: sort by overlap (how many modalities returned this person) then by confidence score.
    """
    from app.routers.match import run_match, upload_and_match

    files = files or []
    image_refs = {}
    text_refs = {}
    voice_refs = {}
    transcript = ""

    if submission_id and submission_id.strip():
        try:
            res = run_match(submission_id.strip())
            image_refs = _refs_from_image_matches(res.get("matches") or [])
        except Exception:
            pass

    if not image_refs and files:
        try:
            image_types = '["face_frontal"]'
            res = await upload_and_match(files=files, image_types=image_types)
            image_refs = _refs_from_image_matches(res.get("matches") or [])
        except Exception:
            pass

    if query and query.strip():
        out = search_by_query({"query": query.strip()})
        text_refs = _refs_from_shortlist(out.get("shortlist") or [])

    if audio and audio.filename:
        content = await audio.read()
        if content:
            try:
                from faster_whisper import WhisperModel
                model = WhisperModel("base", device="cpu", compute_type="int8")
                segments, _ = model.transcribe(content, language="en")
                transcript = " ".join(s.text for s in segments).strip()
            except Exception:
                transcript = ""
            if transcript:
                out = search_by_query({"query": transcript})
                voice_refs = _refs_from_shortlist(out.get("shortlist") or [])

    all_ids = set(image_refs) | set(text_refs) | set(voice_refs)
    merged = []
    for ref_id in all_ids:
        info = image_refs.get(ref_id) or text_refs.get(ref_id) or voice_refs.get(ref_id)
        label = (info or {}).get("label") or ref_id
        photo_path = (info or {}).get("photo_path")
        si = (image_refs.get(ref_id) or {}).get("score") or 0
        st = (text_refs.get(ref_id) or {}).get("score") or 0
        sv = (voice_refs.get(ref_id) or {}).get("score") or 0
        overlap = (1 if si > 0 else 0) + (1 if st > 0 else 0) + (1 if sv > 0 else 0)
        combined_score = max(si, st, sv) if (si or st or sv) else 0
        sources = []
        if si > 0:
            sources.append("image")
        if st > 0:
            sources.append("text")
        if sv > 0:
            sources.append("voice")
        merged.append({
            "id": ref_id,
            "label": label,
            "photo_path": photo_path,
            "overlap": overlap,
            "sources": sources,
            "score": combined_score,
            "score_image": si,
            "score_text": st,
            "score_voice": sv,
        })

    merged.sort(key=lambda x: (-x["overlap"], -x["score"]))
    return {"results": merged[:50], "transcript": transcript}


@router.get("/reference_persons/{person_id}")
def get_reference_person(person_id: str):
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, label, photo_path, attributes, created_at FROM reference_persons WHERE id = ?",
            (person_id,),
        ).fetchone()
        if not row:
            raise HTTPException(404, "Reference person not found")
    return {
        "id": row["id"],
        "label": row["label"],
        "photo_path": row["photo_path"],
        "attributes": json.loads(row["attributes"] or "{}") if isinstance(row["attributes"], str) else (row["attributes"] or {}),
        "created_at": row["created_at"],
    }


@router.post("/search/all")
def search_all():
    """
    Search through all submissions and the repository: match every submission's
    face embeddings against reference persons, then return relevant matches
    (reference persons that matched any submission), sorted by best score then
    by how many submissions matched.
    """
    from collections import defaultdict
    from app.services import qdrant_client

    with get_db() as conn:
        submission_rows = conn.execute("SELECT id FROM submissions ORDER BY created_at DESC").fetchall()
    submission_ids = [r["id"] for r in submission_rows]

    by_ref = defaultdict(list)
    for submission_id in submission_ids:
        points = qdrant_client.get_vectors_by_submission(submission_id)
        if not points:
            continue
        for p in points:
            vector = p.get("vector")
            if vector is None:
                continue
            if isinstance(vector, list):
                import numpy as np
                vector = np.array(vector, dtype=np.float32)
            results = qdrant_client.search_reference_only(vector, limit=15)
            for r in results:
                ref_id = (r.get("payload") or {}).get("reference_person_id")
                if ref_id and r.get("score") is not None:
                    by_ref[ref_id].append({"submission_id": submission_id, "score": r["score"]})

    ref_ids = list(by_ref.keys())
    if not ref_ids:
        return {"results": [], "message": "No submissions with face embeddings, or no reference persons in repository."}

    with get_db() as conn:
        refs = {}
        for ref_id in ref_ids:
            row = conn.execute(
                "SELECT id, label, photo_path FROM reference_persons WHERE id = ?", (ref_id,)
            ).fetchone()
            if row:
                refs[ref_id] = {"label": row["label"], "photo_path": row["photo_path"]}

    merged = []
    for ref_id, hits in by_ref.items():
        best = max(h["score"] for h in hits)
        match_count = len(set(h["submission_id"] for h in hits))
        info = refs.get(ref_id) or {}
        merged.append({
            "id": ref_id,
            "label": info.get("label") or ref_id,
            "photo_path": info.get("photo_path"),
            "score": best,
            "match_count": match_count,
            "matched_by": [{"submission_id": h["submission_id"], "score": h["score"]} for h in hits[:10]],
        })

    merged.sort(key=lambda x: (-x["score"], -x["match_count"]))
    return {"results": merged[:50]}
