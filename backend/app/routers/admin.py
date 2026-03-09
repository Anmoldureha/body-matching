import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.auth import hash_password, require_admin
from app.database import get_db, audit_log_insert

router = APIRouter()


def _user_row_to_dict(row) -> dict:
    return {
        "id": row["id"],
        "username": row["username"],
        "name": row["name"],
        "role": row["role"],
        "district": row["district"],
        "station": row["station"],
        "is_active": bool(row["is_active"]),
        "created_at": row["created_at"],
    }


class CreateUserBody(BaseModel):
    username: str
    password: str
    name: str
    role: str = "field_officer"


class UpdateUserBody(BaseModel):
    name: str | None = None
    role: str | None = None
    is_active: bool | None = None
    password: str | None = None


VALID_ROLES = {"field_officer", "investigator", "supervisor", "admin"}


@router.get("/admin/users")
def list_users(
    current_user: Annotated[dict, Depends(require_admin)],
    role: str | None = Query(default=None),
    is_active: int | None = Query(default=None),
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
):
    with get_db() as conn:
        query = "SELECT id, username, name, role, district, station, is_active, created_at FROM users WHERE 1=1"
        params = []
        if role is not None:
            query += " AND role = ?"
            params.append(role)
        if is_active is not None:
            query += " AND is_active = ?"
            params.append(1 if is_active else 0)
        query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        rows = conn.execute(query, params).fetchall()
    return [_user_row_to_dict(r) for r in rows]


@router.post("/admin/users")
def create_user(
    body: CreateUserBody,
    current_user: Annotated[dict, Depends(require_admin)],
):
    username = (body.username or "").strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"role must be one of {sorted(VALID_ROLES)}")
    if not (body.password or "").strip():
        raise HTTPException(status_code=400, detail="Password is required")
    user_id = str(uuid.uuid4())
    password_hash = hash_password(body.password)
    with get_db() as conn:
        existing = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="Username already exists")
        conn.execute(
            """INSERT INTO users (id, username, password_hash, name, role, is_active)
               VALUES (?, ?, ?, ?, ?, 1)""",
            (user_id, username, password_hash, body.name.strip(), body.role),
        )
        audit_log_insert(conn, "user.create", "user", user_id, user_id=current_user["id"])
        row = conn.execute(
            "SELECT id, username, name, role, district, station, is_active, created_at FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
    return _user_row_to_dict(dict(row))


@router.patch("/admin/users/{user_id}")
def update_user(
    user_id: str,
    body: UpdateUserBody,
    current_user: Annotated[dict, Depends(require_admin)],
):
    updates = []
    params = []
    if body.name is not None:
        updates.append("name = ?")
        params.append(body.name.strip())
    if body.role is not None:
        if body.role not in VALID_ROLES:
            raise HTTPException(status_code=400, detail=f"role must be one of {sorted(VALID_ROLES)}")
        updates.append("role = ?")
        params.append(body.role)
    if body.is_active is not None:
        updates.append("is_active = ?")
        params.append(1 if body.is_active else 0)
    if body.password is not None and body.password.strip():
        updates.append("password_hash = ?")
        params.append(hash_password(body.password))
    if not updates:
        with get_db() as conn:
            row = conn.execute(
                "SELECT id, username, name, role, district, station, is_active, created_at FROM users WHERE id = ?",
                (user_id,),
            ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        return _user_row_to_dict(dict(row))
    params.append(user_id)
    with get_db() as conn:
        row = conn.execute(
            "SELECT id FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        conn.execute(
            "UPDATE users SET " + ", ".join(updates) + " WHERE id = ?",
            params,
        )
        audit_log_insert(conn, "user.update", "user", user_id, user_id=current_user["id"])
        row = conn.execute(
            "SELECT id, username, name, role, district, station, is_active, created_at FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
    return _user_row_to_dict(dict(row))
