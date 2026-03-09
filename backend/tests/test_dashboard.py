def test_dashboard(client):
    r = client.get("/api/dashboard")
    assert r.status_code == 200
    body = r.json()
    assert "total_submissions" in body
    assert "pending_review" in body
    assert "matched" in body
    assert "recent" in body
    assert isinstance(body["recent"], list)
