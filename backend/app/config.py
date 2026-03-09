import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
SUBMISSIONS_STORAGE_PATH = Path(os.getenv("SUBMISSIONS_STORAGE_PATH", str(BASE_DIR / "uploads")))
REFERENCE_PHOTOS_PATH = Path(os.getenv("REFERENCE_PHOTOS_PATH", str(BASE_DIR / "reference_photos")))
# Qdrant: default is persistent local storage (no Docker). Use :memory: for in-memory only; http://localhost:6333 for a Qdrant server.
QDRANT_DATA_PATH = BASE_DIR / "qdrant_data"
QDRANT_URL = os.getenv("QDRANT_URL", str(QDRANT_DATA_PATH))
QDRANT_COLLECTION = os.getenv("QDRANT_COLLECTION", "face_embeddings")
SQLITE_PATH = os.getenv("SQLITE_PATH", str(BASE_DIR / "ubis.db"))

# JWT auth
JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-production")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))  # 24h

# Face embedding dimension (InsightFace 512; face_recognition 128)
EMBEDDING_DIM = 512

SUBMISSIONS_STORAGE_PATH.mkdir(parents=True, exist_ok=True)
REFERENCE_PHOTOS_PATH.mkdir(parents=True, exist_ok=True)
# Persistent Qdrant storage (when QDRANT_URL is a path)
if "://" not in QDRANT_URL and QDRANT_URL != ":memory:":
    Path(QDRANT_URL).mkdir(parents=True, exist_ok=True)
