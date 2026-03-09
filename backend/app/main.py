from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import SUBMISSIONS_STORAGE_PATH, REFERENCE_PHOTOS_PATH
from app.database import init_db
from app.routers import submissions, match, feedback, audit, dashboard, search, auth, admin

init_db()

app = FastAPI(title="UBIS API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploads for submission images
uploads_path = Path(SUBMISSIONS_STORAGE_PATH)
if uploads_path.exists():
    app.mount("/api/files", StaticFiles(directory=str(uploads_path)), name="files")
# Mount reference photos for demo repo
if REFERENCE_PHOTOS_PATH.exists():
    app.mount("/api/reference_files", StaticFiles(directory=str(REFERENCE_PHOTOS_PATH)), name="reference_files")

app.include_router(submissions.router, prefix="/api", tags=["submissions"])
app.include_router(match.router, prefix="/api", tags=["match"])
app.include_router(feedback.router, prefix="/api", tags=["feedback"])
app.include_router(audit.router, prefix="/api", tags=["audit"])
app.include_router(dashboard.router, prefix="/api", tags=["dashboard"])
app.include_router(search.router, prefix="/api", tags=["search"])
app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(admin.router, prefix="/api", tags=["admin"])


@app.get("/api/health")
def health():
    return {"status": "ok"}
