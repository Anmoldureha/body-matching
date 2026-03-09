def test_audit_list(client):
    r = client.get("/api/audit")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_audit_pagination(client):
    r = client.get("/api/audit?limit=5&offset=0")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
