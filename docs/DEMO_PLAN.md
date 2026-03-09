# UBIS Demo Plan

Demo script and asset paths for the Unidentified Bodies Identification System (Body matching).

---

## 1. Demo asset paths

| Purpose | Path | Notes |
|--------|------|--------|
| **Reference photos (missing persons)** | `backend/reference_photos/` | JPG/PNG; seeded into DB + Qdrant via `seed_demo_repository` |
| **Sample test images (download)** | `sample_test_images/` | From project root; created by `scripts/download-sample-images.sh` |
| **Submission uploads** | `backend/uploads/` | Per-submission folders; created at runtime |
| **Demo screenshots / artifacts** | `docs/demo/images/` | Optional: place screenshots here for docs or slides |

### Quick path reference

```
Body matching/
├── backend/
│   ├── reference_photos/     ← Put reference (missing-person) images here
│   ├── uploads/              ← Submission photos (auto-created)
│   └── ubis.db               ← SQLite (created on first run)
├── sample_test_images/       ← Output of download-sample-images.sh
├── scripts/
│   └── download-sample-images.sh
└── docs/
    └── demo/
        └── images/           ← Optional: demo screenshots, flow diagrams
```

---

## 2. Getting demo images

### Option A: Pexels samples (recommended for quick demo)

From project root:

```bash
./scripts/download-sample-images.sh
```

- **Output dir:** `sample_test_images/`
- **Files:** `portrait-man-1.jpeg`, `portrait-woman-1.jpeg`, `portrait-woman-2.jpeg`

Then copy into reference repo and seed:

```bash
cp sample_test_images/*.jpeg backend/reference_photos/
cd backend && python -m scripts.seed_demo_repository
```

### Option B: Your own reference photos

1. Add JPG/PNG files to `backend/reference_photos/`.
2. Run: `cd backend && python -m scripts.seed_demo_repository`

### Option C: DigiFace1M (larger dataset)

```bash
# After downloading a DigiFace1M part (e.g. subj_xxx/0.png layout):
cd backend && python -m scripts.seed_from_digiface1m /path/to/DigiFace1M_part1
```

---

## 3. Pre-demo checklist

- [ ] **Qdrant** running: `docker run -p 6333:6333 qdrant/qdrant`
- [ ] **Backend** running: `cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000`
- [ ] **Frontend** running: `npm run dev` → http://localhost:5173
- [ ] **Reference repo seeded:** images in `backend/reference_photos/` and `python -m scripts.seed_demo_repository` run
- [ ] **Sample images** (optional): `./scripts/download-sample-images.sh` so you have files to upload in Search

---

## 4. Demo flow (step-by-step)

### 4.1 Dashboard

- Open **Dashboard**.
- Show **totals** (reference persons, submissions) and **recent cases** (if any).
- **Talking point:** “Overview of registered cases and reference database size.”

*Optional screenshot:* `docs/demo/images/01-dashboard.png`

---

### 4.2 New Case (register unidentified body)

1. Go to **New Case**.
2. Upload **1–2 face photos** (e.g. from `sample_test_images/portrait-man-1.jpeg`).
3. Fill **attributes** if desired (e.g. gender, age range, visible marks).
4. Submit.
5. Confirm the new submission appears in Dashboard / recent activity.

**Paths used in demo:**

- Upload: `sample_test_images/portrait-man-1.jpeg` (or any `sample_test_images/*.jpeg`)

*Optional screenshot:* `docs/demo/images/02-new-case.png`

---

### 4.3 Search (image + optional text/voice)

1. Go to **Search**.
2. **Image search:** Upload a photo that matches one of your reference persons (e.g. same file you copied to `backend/reference_photos/`).
   - Use: `sample_test_images/portrait-man-1.jpeg` if you seeded it as reference.
3. Click **Search**.
4. Show **matches** with scores and reference photo.
5. Optionally add **text** (e.g. “male, tattoo”) or **voice** and run **combined** search.

**Paths used in demo:**

- Query image: `sample_test_images/portrait-man-1.jpeg` (or `portrait-woman-1.jpeg` if that was seeded)
- Matches show `photo_path` from `reference_persons` (e.g. `portrait-man-1.jpeg` served from backend)

*Optional screenshots:*

- `docs/demo/images/03-search-upload.png`
- `docs/demo/images/04-search-results.png`

---

### 4.4 Schemas & Audit

- **Schemas:** Quick walkthrough of data models (reference persons, submissions, images).
- **Audit log:** Show immutable trail of actions (who did what, when).

*Optional screenshots:*

- `docs/demo/images/05-schemas.png`
- `docs/demo/images/06-audit.png`

---

## 5. Demo image checklist (for screenshots)

If you capture screenshots for docs or slides, use these paths:

| # | Description | Suggested path |
|---|-------------|----------------|
| 1 | Dashboard | `docs/demo/images/01-dashboard.png` |
| 2 | New Case form | `docs/demo/images/02-new-case.png` |
| 3 | Search – upload | `docs/demo/images/03-search-upload.png` |
| 4 | Search – results | `docs/demo/images/04-search-results.png` |
| 5 | Schemas view | `docs/demo/images/05-schemas.png` |
| 6 | Audit log | `docs/demo/images/06-audit.png` |

Create the folder if needed:

```bash
mkdir -p docs/demo/images
```

---

## 6. One-liner demo prep

```bash
# From project root: get samples, seed repo, then run backend + frontend
./scripts/download-sample-images.sh
cp sample_test_images/*.jpeg backend/reference_photos/
cd backend && python -m scripts.seed_demo_repository
# In one terminal: cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000
# In another: npm run dev
```

Then in the app: **Search** → upload `sample_test_images/portrait-man-1.jpeg` → expect a match.

---

## 7. Related docs

- **Architecture / user flow:** `explainer/index.html` (open in browser).
- **Backend setup & seed:** `backend/README.md`.
