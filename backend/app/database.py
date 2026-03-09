import sqlite3
from contextlib import contextmanager
from pathlib import Path
from app.config import SQLITE_PATH

Path(SQLITE_PATH).parent.mkdir(parents=True, exist_ok=True)


@contextmanager
def get_db():
    conn = sqlite3.connect(SQLITE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS submissions (
            id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            attributes_ai TEXT,
            attributes_manual TEXT,
            face_condition TEXT,
            status TEXT DEFAULT 'captured'
        );
        CREATE TABLE IF NOT EXISTS images (
            id TEXT PRIMARY KEY,
            submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
            image_type TEXT NOT NULL,
            path TEXT NOT NULL,
            face_condition TEXT,
            embedding_confidence REAL,
            qdrant_point_id TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS reference_persons (
            id TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            photo_path TEXT,
            attributes TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS matches (
            id TEXT PRIMARY KEY,
            submission_id TEXT NOT NULL,
            reference_person_id TEXT NOT NULL,
            overall_score REAL NOT NULL,
            face_score REAL,
            rank INTEGER NOT NULL,
            status TEXT DEFAULT 'pending_review',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS feedback (
            id TEXT PRIMARY KEY,
            match_id TEXT NOT NULL REFERENCES matches(id),
            reviewer_id TEXT,
            verdict TEXT NOT NULL,
            face_assessment TEXT,
            action_taken TEXT NOT NULL,
            notes TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            action TEXT NOT NULL,
            resource_type TEXT,
            resource_id TEXT,
            ip_address TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'field_officer',
            district TEXT,
            station TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_images_submission ON images(submission_id);
        CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        """)


def audit_log_insert(conn, action: str, resource_type: str = None, resource_id: str = None, user_id: str = None, ip_address: str = None):
    conn.execute(
        "INSERT INTO audit_log (action, resource_type, resource_id, user_id, ip_address) VALUES (?, ?, ?, ?, ?)",
        (action, resource_type, resource_id, user_id, ip_address or "internal"),
    )
