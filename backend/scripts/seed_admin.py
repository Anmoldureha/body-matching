"""
Create default admin user if none exists.
Usage: python -m scripts.seed_admin
"""
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import get_db, init_db
from app.auth import hash_password


def main():
    init_db()
    with get_db() as conn:
        existing = conn.execute("SELECT id FROM users WHERE username = ?", ("admin",)).fetchone()
        if existing:
            print("Admin user already exists. Skipping.")
            return
        user_id = str(uuid.uuid4())
        password_hash = hash_password("changeme")
        conn.execute(
            """INSERT INTO users (id, username, password_hash, name, role, is_active)
               VALUES (?, ?, ?, ?, ?, 1)""",
            (user_id, "admin", password_hash, "Administrator", "admin"),
        )
    print("Created admin user: username=admin, password=changeme")
    print("Change the password after first login.")


if __name__ == "__main__":
    main()
