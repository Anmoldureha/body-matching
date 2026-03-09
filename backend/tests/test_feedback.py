def test_feedback_requires_valid_match(client):
    r = client.post(
        "/api/feedback",
        json={
            "match_id": "00000000-0000-0000-0000-000000000000",
            "verdict": "incorrect_match",
            "action_taken": "none",
        },
    )
    assert r.status_code == 404


def test_feedback_success(client, sample_jpeg):
    from app.database import get_db
    import uuid
    # Create a match row so feedback has something to reference
    mid = str(uuid.uuid4())
    sid = str(uuid.uuid4())
    ref_id = str(uuid.uuid4())
    with get_db() as conn:
        conn.execute("INSERT INTO submissions (id) VALUES (?)", (sid,))
        conn.execute(
            "INSERT INTO reference_persons (id, label) VALUES (?, ?)",
            (ref_id, "Test Ref"),
        )
        conn.execute(
            "INSERT INTO matches (id, submission_id, reference_person_id, overall_score, face_score, rank) VALUES (?, ?, ?, ?, ?, ?)",
            (mid, sid, ref_id, 0.8, 0.8, 1),
        )
    r = client.post(
        "/api/feedback",
        json={
            "match_id": mid,
            "verdict": "incorrect_match",
            "face_assessment": "no_match",
            "action_taken": "none",
            "notes": "Test note",
        },
    )
    assert r.status_code == 200
    assert "id" in r.json()
