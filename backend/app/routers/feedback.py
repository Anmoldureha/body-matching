from typing import Annotated
import uuid
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.auth import get_current_user_optional
from app.database import get_db, audit_log_insert

router = APIRouter()


class FeedbackCreate(BaseModel):
    match_id: str
    verdict: str
    face_assessment: str | None = None
    action_taken: str
    notes: str | None = None


@router.post("/feedback")
def create_feedback(
    body: FeedbackCreate,
    current_user: Annotated[dict | None, Depends(get_current_user_optional)] = None,
):
    feedback_id = str(uuid.uuid4())
    reviewer_id = current_user["id"] if current_user else None
    with get_db() as conn:
        row = conn.execute("SELECT id FROM matches WHERE id = ?", (body.match_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Match not found")
        conn.execute(
            "INSERT INTO feedback (id, match_id, reviewer_id, verdict, face_assessment, action_taken, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (feedback_id, body.match_id, reviewer_id, body.verdict, body.face_assessment, body.action_taken, body.notes or ""),
        )
        audit_log_insert(conn, "feedback.submit", "feedback", feedback_id, user_id=reviewer_id)
    return {"id": feedback_id, "message": "Feedback saved"}
