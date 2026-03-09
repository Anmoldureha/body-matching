# UBIS Backend

FastAPI service for UBIS: submissions, face embedding (InsightFace/local), Qdrant vector search, attribute/voice search.

## Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env
# Edit .env: SUBMISSIONS_STORAGE_PATH, QDRANT_URL, etc.
```

## Qdrant (vector search)

**No Docker required.** The app defaults to persistent local storage in `backend/qdrant_data/`, so search and matching work across restarts.

- **Default:** `qdrant_data/` in the backend directory (persistent).
- **In-memory only:** set `QDRANT_URL=:memory:` in `.env` (data lost on restart).
- **Docker/remote:** set `QDRANT_URL=http://localhost:6333` and run `docker run -p 6333:6333 qdrant/qdrant`.

## Seed demo repository

Add reference images (jpg/png) to `reference_photos/` then:

```bash
python -m scripts.seed_demo_repository
```

## Testing matching with sample images

1. **Web samples (e.g. Pexels)**  
   From the project root, run `./scripts/download-sample-images.sh` to download a few portrait images to `sample_test_images/`. Copy them into `backend/reference_photos/`, then run `python -m scripts.seed_demo_repository`. In the app, use Search and upload one of those images to verify the matching system returns a match.

2. **DigiFace1M**  
   After downloading a part of [DigiFace1M](https://github.com/microsoft/DigiFace1M) (folder layout `subj_<id>/0.png`, ...), seed the repository with:

   ```bash
   python -m scripts.seed_from_digiface1m /path/to/digiface_part
   ```

   Then run the API and use Search to test matches.

To run the E2E test that downloads samples and asserts the matching pipeline (requires network):

```bash
UBIS_TEST_WITH_SAMPLES=1 pytest tests/test_matching_e2e.py -v
```

## Run API

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API: http://localhost:8000  
Docs: http://localhost:8000/docs

## PWA

Point the PWA at this API (e.g. `VITE_API_URL=http://localhost:8000` or set `window.__UBIS_API__`).
