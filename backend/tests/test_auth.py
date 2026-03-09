"""Tests for auth (login) and admin (user management) endpoints."""
import uuid

import pytest

from app.auth import hash_password
from app.database import get_db, init_db


def _seed_test_users():
    init_db()
    admin_id = str(uuid.uuid4())
    officer_id = str(uuid.uuid4())
    with get_db() as conn:
        conn.execute("DELETE FROM users WHERE username IN ('admin_test', 'officer_test')")
        conn.execute(
            "INSERT INTO users (id, username, password_hash, name, role, is_active) VALUES (?, ?, ?, ?, ?, 1)",
            (admin_id, "admin_test", hash_password("adminpass"), "Admin User", "admin"),
        )
        conn.execute(
            "INSERT INTO users (id, username, password_hash, name, role, is_active) VALUES (?, ?, ?, ?, ?, 1)",
            (officer_id, "officer_test", hash_password("officerpass"), "Officer User", "field_officer"),
        )
    return admin_id, officer_id


def test_login_success(client):
    _seed_test_users()
    r = client.post("/api/auth/login", json={"username": "admin_test", "password": "adminpass"})
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["username"] == "admin_test"
    assert data["user"]["role"] == "admin"


def test_login_invalid_credentials(client):
    _seed_test_users()
    r = client.post("/api/auth/login", json={"username": "admin_test", "password": "wrong"})
    assert r.status_code == 401
    r = client.post("/api/auth/login", json={"username": "nobody", "password": "any"})
    assert r.status_code == 401


def test_admin_users_requires_auth(client):
    _seed_test_users()
    r = client.get("/api/admin/users")
    assert r.status_code == 401  # no Bearer -> 401 Unauthorized


def test_admin_users_requires_admin_role(client):
    _seed_test_users()
    login_r = client.post("/api/auth/login", json={"username": "officer_test", "password": "officerpass"})
    assert login_r.status_code == 200
    token = login_r.json()["access_token"]
    r = client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403


def test_admin_users_success(client):
    _seed_test_users()
    login_r = client.post("/api/auth/login", json={"username": "admin_test", "password": "adminpass"})
    assert login_r.status_code == 200
    token = login_r.json()["access_token"]
    r = client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    users = r.json()
    assert isinstance(users, list)
    usernames = [u["username"] for u in users]
    assert "admin_test" in usernames
    assert "officer_test" in usernames
