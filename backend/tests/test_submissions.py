def test_create_submission(client, sample_jpeg):
    files = [("files", ("face.jpg", sample_jpeg, "image/jpeg"))]
    data = {
        "image_types": '["face_frontal"]',
        "attributes_ai": "{}",
        "attributes_manual": "{}",
        "face_condition": "normal",
    }
    r = client.post("/api/submissions", files=files, data=data)
    assert r.status_code == 200
    body = r.json()
    assert "submission_id" in body
    assert "images" in body
    assert len(body["images"]) >= 1


def test_list_submissions(client, sample_jpeg):
    r = client.get("/api/submissions")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_get_submission(client, sample_jpeg):
    files = [("files", ("face.jpg", sample_jpeg, "image/jpeg"))]
    data = {"image_types": '["face_frontal"]', "attributes_ai": "{}", "attributes_manual": "{}"}
    create = client.post("/api/submissions", files=files, data=data)
    sid = create.json()["submission_id"]
    r = client.get(f"/api/submissions/{sid}")
    assert r.status_code == 200
    assert r.json()["id"] == sid
    assert "images" in r.json()


def test_get_submission_404(client):
    r = client.get("/api/submissions/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404
