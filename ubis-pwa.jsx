import { useState, useEffect, useRef } from "react";

// ─── API ─────────────────────────────────────────────────────────────────────
const API_BASE = typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL
  ? import.meta.env.VITE_API_URL
  : (typeof window !== "undefined" && window.__UBIS_API__) || "http://localhost:8000";

const TOKEN_KEY = "ubis_token";
const USER_KEY = "ubis_user";

function getToken() {
  try {
    return typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  } catch {
    return null;
  }
}

function getStoredUser() {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(USER_KEY) : null;
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setAuth(token, user) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  } catch (_) { }
}

function clearAuth() {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  } catch (_) { }
}

function authHeaders() {
  const token = getToken();
  const h = {};
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

function apiFetch(path, opts = {}) {
  const headers = { ...authHeaders(), ...(opts.headers || {}) };
  if (opts.body && typeof opts.body === "string" && !headers["Content-Type"])
    headers["Content-Type"] = "application/json";
  if (opts.body instanceof FormData && headers["Content-Type"]) delete headers["Content-Type"];
  return fetch(`${API_BASE}${path}`, { ...opts, headers }).then((r) => {
    if (r.status === 401) {
      clearAuth();
      if (typeof window !== "undefined") window.dispatchEvent(new Event("ubis-unauthorized"));
    }
    return r;
  });
}

const api = {
  get: (path) => apiFetch(path).then((r) => (r.ok ? r.json() : Promise.reject(r))),
  post: (path, body) =>
    apiFetch(path, {
      method: "POST",
      headers: body instanceof FormData ? {} : { "Content-Type": "application/json" },
      body: body instanceof FormData ? body : JSON.stringify(body),
    }).then((r) => (r.ok ? r.json() : Promise.reject(r))),
  patch: (path, body) =>
    apiFetch(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => (r.ok ? r.json() : Promise.reject(r))),
};

// ─── FONTS & ANIMATIONS ───────────────────────────────────────────────────────
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600;700&display=swap');
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
* { -webkit-tap-highlight-color: transparent; }
@media (max-width: 600px) {
  .main-content { padding: 16px 12px !important; }
  .top-bar { padding: 0 12px !important; gap: 8px !important; }
  .top-bar-logo { display: none !important; }
  .top-bar-tabs button { padding: 12px 10px !important; fontSize: 12px !important; }
  .grid-2 { grid-template-columns: 1fr !important; }
  .modal-container { padding: 0 !important; }
  .modal-content { max-width: 100% !important; height: 100% !important; max-height: 100% !important; border-radius: 0 !important; }
}`;

// ─── DESIGN TOKENS (formal government light theme) ─────────────────────────────
const C = {
  bg: "#f5f6f8", surface: "#ffffff", card: "#ffffff",
  border: "#e2e8f0", borderLight: "#f1f5f9",
  primary: "#1e3a5f", primaryDim: "rgba(30,58,95,0.08)", primaryBorder: "rgba(30,58,95,0.2)",
  accent: "#1d4ed8", accentDim: "rgba(29,78,216,0.08)", accentBorder: "rgba(29,78,216,0.25)",
  emerald: "#047857", emeraldDim: "rgba(4,120,87,0.08)", emeraldBorder: "rgba(4,120,87,0.2)",
  rose: "#b91c1c", roseDim: "rgba(185,28,28,0.08)", roseBorder: "rgba(185,28,28,0.2)",
  amber: "#b45309", amberDim: "rgba(180,83,9,0.08)", amberBorder: "rgba(180,83,9,0.2)",
  violet: "#5b21b6", violetDim: "rgba(91,33,182,0.08)", violetBorder: "rgba(91,33,182,0.2)",
  cyan: "#0e7490", cyanDim: "rgba(14,116,144,0.08)", cyanBorder: "rgba(14,116,144,0.2)",
  sky: "#0369a1",
  text: "#1e293b", textMid: "#475569", textDim: "#64748b",
  mono: "'Source Sans 3', 'Segoe UI', system-ui, sans-serif",
  display: "'Source Sans 3', 'Segoe UI', system-ui, sans-serif",
};

// ─── SCHEMAS ──────────────────────────────────────────────────────────────────
const PG_TABLES = [
  {
    name: "cases", color: C.cyan, desc: "Core table. One row per unidentified body case.", cols: [
      { col: "id", type: "UUID", constraint: "PK DEFAULT gen_random_uuid()", desc: "Primary key" },
      { col: "case_number", type: "VARCHAR(20)", constraint: "UNIQUE NOT NULL", desc: "e.g. HR-2024-00341. Auto-generated: {state}-{year}-{seq}" },
      { col: "status", type: "ENUM", constraint: "NOT NULL DEFAULT 'captured'", desc: "captured → processing → under_review → matched → resolved → closed" },
      { col: "found_date", type: "DATE", constraint: "NOT NULL", desc: "Date body was found" },
      { col: "found_district", type: "VARCHAR(100)", constraint: "NOT NULL", desc: "Haryana district name" },
      { col: "found_gps_lat", type: "DECIMAL(9,6)", constraint: "", desc: "GPS latitude (optional)" },
      { col: "found_gps_lng", type: "DECIMAL(9,6)", constraint: "", desc: "GPS longitude (optional)" },
      { col: "found_by_officer_id", type: "UUID", constraint: "FK users(id)", desc: "Officer who filed the case" },
      { col: "assigned_to", type: "UUID", constraint: "FK users(id)", desc: "Investigator assigned to review" },
      { col: "ps_name", type: "VARCHAR(200)", constraint: "", desc: "Police Station name" },
      { col: "notes", type: "TEXT", constraint: "", desc: "Free-text case notes" },
      { col: "created_at", type: "TIMESTAMPTZ", constraint: "DEFAULT now()", desc: "" },
      { col: "updated_at", type: "TIMESTAMPTZ", constraint: "DEFAULT now()", desc: "Auto-updated via trigger" },
    ]
  },
  {
    name: "persons", color: C.amber, desc: "Physical attribute profile of the unidentified person.", cols: [
      { col: "id", type: "UUID", constraint: "PK", desc: "" },
      { col: "case_id", type: "UUID", constraint: "FK cases(id) ON DELETE CASCADE", desc: "One person per case" },
      { col: "estimated_age_min", type: "SMALLINT", constraint: "", desc: "Lower bound from AI + officer estimate" },
      { col: "estimated_age_max", type: "SMALLINT", constraint: "", desc: "Upper bound" },
      { col: "gender", type: "ENUM", constraint: "", desc: "male / female / unknown" },
      { col: "height_cm_min", type: "SMALLINT", constraint: "", desc: "Estimated height lower bound" },
      { col: "height_cm_max", type: "SMALLINT", constraint: "", desc: "Estimated height upper bound" },
      { col: "build", type: "ENUM", constraint: "", desc: "slim / medium / heavy / unknown" },
      { col: "skin_tone", type: "ENUM", constraint: "", desc: "fair / medium / dark / unknown" },
      { col: "hair_color", type: "VARCHAR(50)", constraint: "", desc: "e.g. black, grey, brown" },
      { col: "hair_style", type: "VARCHAR(100)", constraint: "", desc: "e.g. short, long, bald, curly" },
      { col: "beard", type: "BOOLEAN", constraint: "DEFAULT false", desc: "" },
      { col: "beard_style", type: "VARCHAR(100)", constraint: "", desc: "e.g. full, stubble, moustache" },
      { col: "visible_marks", type: "TEXT", constraint: "", desc: "Free-text description of marks/scars/moles" },
      { col: "clothing_description", type: "TEXT", constraint: "", desc: "Officer's manual description" },
      { col: "language_spoken", type: "VARCHAR(100)", constraint: "", desc: "If person is alive and speaking" },
      { col: "ai_age_confidence", type: "DECIMAL(4,3)", constraint: "", desc: "0-1 confidence score from attribute estimator" },
      { col: "updated_at", type: "TIMESTAMPTZ", constraint: "DEFAULT now()", desc: "" },
    ]
  },
  {
    name: "images", color: C.violet, desc: "Every image uploaded per case, with blob paths and AI metadata.", cols: [
      { col: "id", type: "UUID", constraint: "PK", desc: "" },
      { col: "case_id", type: "UUID", constraint: "FK cases(id)", desc: "" },
      { col: "image_type", type: "ENUM", constraint: "NOT NULL", desc: "face_frontal / face_left / face_right / full_body / tattoo / clothing / belonging / other" },
      { col: "blob_path", type: "VARCHAR(500)", constraint: "NOT NULL", desc: "Azure Blob path: cases/{case_id}/original/{id}.jpg" },
      { col: "enhanced_blob_path", type: "VARCHAR(500)", constraint: "", desc: "Real-ESRGAN output path" },
      { col: "face_crop_blob_path", type: "VARCHAR(500)", constraint: "", desc: "Auto-cropped face region" },
      { col: "thumbnail_blob_path", type: "VARCHAR(500)", constraint: "", desc: "cases/{case_id}/thumbs/{id}_thumb.jpg" },
      { col: "quality_score", type: "DECIMAL(4,3)", constraint: "", desc: "0-1: blur, framing, occlusion composite score" },
      { col: "is_primary", type: "BOOLEAN", constraint: "DEFAULT false", desc: "Primary face image for this case" },
      { col: "ai_tags", type: "JSONB", constraint: "", desc: 'YOLOv8 output: [{"class":"shirt","color":"blue","confidence":0.91}]' },
      { col: "width_px", type: "INT", constraint: "", desc: "" },
      { col: "height_px", type: "INT", constraint: "", desc: "" },
      { col: "file_size_bytes", type: "BIGINT", constraint: "", desc: "" },
      { col: "uploaded_by", type: "UUID", constraint: "FK users(id)", desc: "" },
      { col: "uploaded_at", type: "TIMESTAMPTZ", constraint: "DEFAULT now()", desc: "" },
    ]
  },
  {
    name: "matches", color: C.emerald, desc: "AI-generated match candidates linking a case to missing persons.", cols: [
      { col: "id", type: "UUID", constraint: "PK", desc: "" },
      { col: "case_id", type: "UUID", constraint: "FK cases(id)", desc: "The unidentified body case" },
      { col: "missing_person_id", type: "UUID", constraint: "FK missing_persons(id) NULLABLE", desc: "If matched to MP database" },
      { col: "overall_score", type: "DECIMAL(5,4)", constraint: "NOT NULL", desc: "Composite 0-1 score from re-ranking" },
      { col: "face_score", type: "DECIMAL(5,4)", constraint: "", desc: "InsightFace cosine similarity" },
      { col: "clothing_score", type: "DECIMAL(5,4)", constraint: "", desc: "YOLOv8 clothing feature similarity" },
      { col: "tattoo_score", type: "DECIMAL(5,4)", constraint: "", desc: "Tattoo/mark pattern similarity" },
      { col: "attribute_score", type: "DECIMAL(5,4)", constraint: "", desc: "Age/gender/build match score" },
      { col: "rank", type: "SMALLINT", constraint: "NOT NULL", desc: "1 = best match for this case" },
      { col: "status", type: "ENUM", constraint: "DEFAULT 'pending_review'", desc: "pending_review / confirmed / rejected / referred_forensics" },
      { col: "reviewed_by", type: "UUID", constraint: "FK users(id) NULLABLE", desc: "Investigator who reviewed" },
      { col: "reviewed_at", type: "TIMESTAMPTZ", constraint: "", desc: "" },
      { col: "created_at", type: "TIMESTAMPTZ", constraint: "DEFAULT now()", desc: "" },
    ]
  },
  {
    name: "feedback", color: C.rose, desc: "Human investigator feedback on AI match quality. Used for future model improvement.", cols: [
      { col: "id", type: "UUID", constraint: "PK", desc: "" },
      { col: "match_id", type: "UUID", constraint: "FK matches(id)", desc: "The match being reviewed" },
      { col: "reviewer_id", type: "UUID", constraint: "FK users(id) NOT NULL", desc: "" },
      { col: "verdict", type: "ENUM", constraint: "NOT NULL", desc: "correct_match / incorrect_match / possible_match / needs_more_info" },
      { col: "face_assessment", type: "ENUM", constraint: "", desc: "strong_match / weak_match / no_match / not_visible" },
      { col: "clothing_assessment", type: "ENUM", constraint: "", desc: "strong_match / weak_match / no_match / not_relevant" },
      { col: "tattoo_assessment", type: "ENUM", constraint: "", desc: "strong_match / weak_match / no_match / no_tattoo" },
      { col: "ai_score_fair", type: "BOOLEAN", constraint: "", desc: "Was AI score reasonable?" },
      { col: "notes", type: "TEXT", constraint: "", desc: "Investigator notes on why match accepted/rejected" },
      { col: "action_taken", type: "ENUM", constraint: "NOT NULL", desc: "case_closed / referred_forensics / referred_family / further_investigation / none" },
      { col: "created_at", type: "TIMESTAMPTZ", constraint: "DEFAULT now()", desc: "" },
    ]
  },
  {
    name: "missing_persons", color: C.sky, desc: "Cross-reference DB of reported missing persons (police + family submitted).", cols: [
      { col: "id", type: "UUID", constraint: "PK", desc: "" },
      { col: "source", type: "ENUM", constraint: "NOT NULL", desc: "police_reported / family_submitted / cctns / zipnet" },
      { col: "name", type: "VARCHAR(200)", constraint: "NOT NULL", desc: "" },
      { col: "age", type: "SMALLINT", constraint: "", desc: "Age at time of reporting" },
      { col: "gender", type: "ENUM", constraint: "", desc: "" },
      { col: "last_seen_date", type: "DATE", constraint: "", desc: "" },
      { col: "last_seen_district", type: "VARCHAR(100)", constraint: "", desc: "" },
      { col: "fir_number", type: "VARCHAR(100)", constraint: "", desc: "FIR reference if police-reported" },
      { col: "contact_number", type: "VARCHAR(20)", constraint: "", desc: "Family contact" },
      { col: "photo_blob_path", type: "VARCHAR(500)", constraint: "", desc: "Reference photo in Blob Storage" },
      { col: "face_qdrant_id", type: "UUID", constraint: "", desc: "Point ID in Qdrant face_embeddings collection" },
      { col: "attributes", type: "JSONB", constraint: "", desc: '{"height_cm":172,"build":"medium","marks":"scar on chin"}' },
      { col: "is_resolved", type: "BOOLEAN", constraint: "DEFAULT false", desc: "Mark resolved when identified" },
      { col: "created_at", type: "TIMESTAMPTZ", constraint: "DEFAULT now()", desc: "" },
    ]
  },
  {
    name: "users", color: "#a78bfa", desc: "System users with roles. Synced from Keycloak on first login.", cols: [
      { col: "id", type: "UUID", constraint: "PK", desc: "" },
      { col: "keycloak_id", type: "VARCHAR(100)", constraint: "UNIQUE NOT NULL", desc: "Keycloak sub claim" },
      { col: "name", type: "VARCHAR(200)", constraint: "NOT NULL", desc: "" },
      { col: "badge_number", type: "VARCHAR(50)", constraint: "UNIQUE", desc: "Police badge/BP number" },
      { col: "role", type: "ENUM", constraint: "NOT NULL", desc: "field_officer / investigator / supervisor / admin" },
      { col: "district", type: "VARCHAR(100)", constraint: "", desc: "Home district (for data scoping)" },
      { col: "station", type: "VARCHAR(200)", constraint: "", desc: "Police station" },
      { col: "is_active", type: "BOOLEAN", constraint: "DEFAULT true", desc: "Soft-disable without deleting" },
      { col: "last_login_at", type: "TIMESTAMPTZ", constraint: "", desc: "" },
      { col: "created_at", type: "TIMESTAMPTZ", constraint: "DEFAULT now()", desc: "" },
    ]
  },
  {
    name: "audit_log", color: "#64748b", desc: "Immutable append-only audit trail. INSERT only — no UPDATE or DELETE ever.", cols: [
      { col: "id", type: "UUID", constraint: "PK", desc: "" },
      { col: "user_id", type: "UUID", constraint: "FK users(id) NULLABLE", desc: "Null for AI/system actions" },
      { col: "action", type: "VARCHAR(100)", constraint: "NOT NULL", desc: "e.g. case.view, match.confirm, user.login, ai.embed.face" },
      { col: "resource_type", type: "VARCHAR(50)", constraint: "", desc: "case / match / user / image / feedback" },
      { col: "resource_id", type: "UUID", constraint: "", desc: "ID of the affected resource" },
      { col: "ip_address", type: "INET", constraint: "", desc: "Requester IP" },
      { col: "user_agent", type: "TEXT", constraint: "", desc: "Browser/app user agent" },
      { col: "payload_hash", type: "VARCHAR(64)", constraint: "", desc: "SHA-256 of request body (not stored, just hash)" },
      { col: "created_at", type: "TIMESTAMPTZ", constraint: "DEFAULT now() NOT NULL", desc: "Never updated" },
    ]
  },
];

const QDRANT_COLLECTIONS = [
  {
    name: "face_embeddings", color: C.cyan, model: "InsightFace buffalo-l", dims: 512, distance: "Cosine",
    desc: "512-dimensional face embeddings. One point per image with a detected face.",
    payload: [
      { key: "case_id", type: "string (UUID)", desc: "Reference back to PostgreSQL cases.id" },
      { key: "image_id", type: "string (UUID)", desc: "Reference to images.id" },
      { key: "case_status", type: "string", desc: "For filtered search: exclude resolved/closed" },
      { key: "district", type: "string", desc: "Enable geo-filtered search" },
      { key: "found_date_epoch", type: "integer", desc: "Unix timestamp for date-range filter" },
      { key: "est_age_min", type: "integer", desc: "Enable attribute-filtered search" },
      { key: "est_age_max", type: "integer", desc: "" },
      { key: "gender", type: "string", desc: "male / female / unknown" },
      { key: "is_missing_person", type: "boolean", desc: "True if this is an MP reference photo" },
      { key: "source_type", type: "string", desc: "case_capture / missing_person / family_submitted" },
    ]
  },
  {
    name: "clothing_features", color: C.amber, model: "YOLOv8 + custom CNN", dims: 256, distance: "Cosine",
    desc: "256-dim clothing feature vectors. One point per detected clothing item per image.",
    payload: [
      { key: "case_id", type: "string (UUID)", desc: "" },
      { key: "image_id", type: "string (UUID)", desc: "" },
      { key: "detected_items", type: "array[string]", desc: '["shirt","trousers","sandals"]' },
      { key: "primary_color", type: "string", desc: "Dominant clothing color (for text filter)" },
      { key: "secondary_color", type: "string", desc: "" },
      { key: "style", type: "string", desc: "formal / casual / traditional / sportswear / unknown" },
      { key: "confidence", type: "float", desc: "YOLOv8 detection confidence" },
    ]
  },
  {
    name: "tattoo_features", color: C.violet, model: "YOLOv8 + patch CNN", dims: 256, distance: "Cosine",
    desc: "256-dim tattoo/mark/scar feature vectors. One point per detected mark.",
    payload: [
      { key: "case_id", type: "string (UUID)", desc: "" },
      { key: "image_id", type: "string (UUID)", desc: "" },
      { key: "body_location", type: "string", desc: "right_arm / left_arm / neck / chest / back / face / leg / unknown" },
      { key: "mark_type", type: "string", desc: "tattoo / scar / mole / birthmark / burn_mark" },
      { key: "approx_size", type: "string", desc: "small / medium / large" },
      { key: "dominant_color", type: "string", desc: "black / blue / multicolor / skin_tone (scars)" },
    ]
  },
];

const BLOB_STRUCTURE = [
  {
    container: "case-images", access: "Private · AES-256 · Signed URLs only", tier: "Hot (0-90d) → Cool (90d+) → Archive (3yr+)", paths: [
      { path: "cases/{case_id}/original/{image_id}_{type}.jpg", desc: "Raw upload from field app. Never modified." },
      { path: "cases/{case_id}/enhanced/{image_id}_{type}_4x.jpg", desc: "Real-ESRGAN enhanced version" },
      { path: "cases/{case_id}/crops/face/{image_id}_face.jpg", desc: "Auto-cropped face region (InsightFace detection)" },
      { path: "cases/{case_id}/crops/tattoo/{image_id}_tattoo_{n}.jpg", desc: "Cropped tattoo/mark regions (YOLOv8)" },
      { path: "cases/{case_id}/crops/clothing/{image_id}_clothing.jpg", desc: "Cropped clothing region" },
      { path: "cases/{case_id}/thumbs/{image_id}_128.jpg", desc: "128x128 thumbnail for UI display" },
    ]
  },
  {
    container: "missing-persons", access: "Private · Restricted to investigator+ role", tier: "Hot always", paths: [
      { path: "{mp_id}/photo_original.jpg", desc: "Reference photo from family/police" },
      { path: "{mp_id}/face_crop.jpg", desc: "Auto-cropped face for embedding" },
      { path: "{mp_id}/thumb_128.jpg", desc: "Thumbnail for search results UI" },
    ]
  },
  {
    container: "exports", access: "Private · Short-lived SAS tokens (15 min expiry)", tier: "Cool · Auto-delete 7d", paths: [
      { path: "reports/{case_id}_{timestamp}.pdf", desc: "Case report PDF for supervisor/court" },
      { path: "bulk/{export_id}.zip", desc: "Bulk case data export for admin" },
    ]
  },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const statusColors = {
  captured: { bg: "rgba(71,85,105,0.1)", border: "#475569", text: "#475569" },
  processing: { bg: "rgba(180,83,9,0.1)", border: "#b45309", text: "#b45309" },
  under_review: { bg: "rgba(14,116,144,0.1)", border: "#0e7490", text: "#0e7490" },
  matched: { bg: "rgba(4,120,87,0.1)", border: "#047857", text: "#047857" },
  resolved: { bg: "rgba(91,33,182,0.08)", border: "#5b21b6", text: "#5b21b6" },
  closed: { bg: "rgba(100,116,139,0.08)", border: "#64748b", text: "#64748b" },
  pending_review: { bg: "rgba(180,83,9,0.1)", border: "#b45309", text: "#b45309" },
  confirmed: { bg: "rgba(4,120,87,0.1)", border: "#047857", text: "#047857" },
  rejected: { bg: "rgba(185,28,28,0.1)", border: "#b91c1c", text: "#b91c1c" },
};

const Badge = ({ label, color }) => {
  const s = statusColors[label] || statusColors.captured;
  return (
    <span style={{
      fontSize: 10, fontFamily: C.mono, fontWeight: 700, letterSpacing: 1,
      padding: "2px 8px", borderRadius: 3, textTransform: "uppercase",
      background: color ? "transparent" : s.bg,
      border: `1px solid ${color || s.border}`,
      color: color || s.text,
    }}>{label.replace(/_/g, " ")}</span>
  );
};

const ScoreBar = ({ value, color = C.emerald }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <div style={{ flex: 1, height: 4, background: C.borderLight, borderRadius: 2, overflow: "hidden" }}>
      <div style={{ width: `${value * 100}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.6s ease" }} />
    </div>
    <span style={{ fontSize: 11, color, fontFamily: C.mono, fontWeight: 700, minWidth: 36 }}>{(value * 100).toFixed(0)}%</span>
  </div>
);

const SectionLabel = ({ label }) => (
  <div style={{ fontSize: 10, fontFamily: C.mono, letterSpacing: 3, color: C.textDim, fontWeight: 700, marginBottom: 16, textTransform: "uppercase" }}>
    {label}
  </div>
);

// ─── LOGIN ───────────────────────────────────────────────────────────────────
function Login({ onSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || "Invalid credentials");
        setLoading(false);
        return;
      }
      setAuth(data.access_token, data.user);
      onSuccess(data.user);
    } catch (_) {
      setError("Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 360, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 32, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <div style={{ fontFamily: C.display, fontSize: 22, fontWeight: 700, color: C.primary, marginBottom: 8 }}>UBIS</div>
        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 24 }}>Sign in to continue</div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 11, color: C.textDim, fontFamily: C.mono, marginBottom: 6 }}>Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username"
              style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.borderLight}`, borderRadius: 6, padding: "10px 12px", color: C.text, fontFamily: C.mono, fontSize: 13 }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 11, color: C.textDim, fontFamily: C.mono, marginBottom: 6 }}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
              style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.borderLight}`, borderRadius: 6, padding: "10px 12px", color: C.text, fontFamily: C.mono, fontSize: 13 }} />
          </div>
          {error && <div style={{ marginBottom: 12, padding: "8px 12px", background: C.roseDim, border: `1px solid ${C.roseBorder}`, borderRadius: 6, fontSize: 12, color: C.rose }}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{ width: "100%", padding: "12px 16px", background: C.primary, color: "#fff", border: "none", borderRadius: 6, fontFamily: C.mono, fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── MOBILE-FRIENDLY CAPTURE CONTROLS ─────────────────────────────────────────
function ImageCaptureControl({ onFile, disabled }) {
  const fileInputRef = useRef(null);
  const uploadInputRef = useRef(null);
  const handleCapture = () => fileInputRef.current?.click();
  const handleUpload = () => uploadInputRef.current?.click();
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = "";
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginTop: 6 }}>
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleFile} />
      <input ref={uploadInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
      <button type="button" onClick={handleCapture} disabled={disabled}
        style={{ minHeight: 44, minWidth: 44, padding: "10px 16px", background: C.cyanDim, border: `1px solid ${C.cyanBorder}`, borderRadius: 8, fontSize: 13, fontFamily: C.mono, fontWeight: 700, color: C.cyan, cursor: disabled ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, opacity: disabled ? 0.6 : 1, WebkitTapHighlightColor: "transparent" }}>
        Capture
      </button>
      <button type="button" onClick={handleUpload} disabled={disabled}
        style={{ minHeight: 44, minWidth: 44, padding: "10px 16px", background: C.borderLight, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: C.mono, fontWeight: 600, color: C.textMid, cursor: disabled ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, opacity: disabled ? 0.6 : 1, WebkitTapHighlightColor: "transparent" }}>
        Upload
      </button>
    </div>
  );
}

function VoiceCaptureControl({ onFile, disabled }) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const uploadInputRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        onFile(new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" }));
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch (err) {
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    clearInterval(timerRef.current);
    setRecording(false);
    setDuration(0);
  };

  const handleUpload = () => uploadInputRef.current?.click();
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = "";
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
      <input ref={uploadInputRef} type="file" accept="audio/*" style={{ display: "none" }} onChange={handleFile} />
      {!recording ? (
        <>
          <button type="button" onClick={startRecording} disabled={disabled}
            style={{ minHeight: 44, minWidth: 44, padding: "10px 16px", background: C.cyanDim, border: `1px solid ${C.cyanBorder}`, borderRadius: 8, fontSize: 13, fontFamily: C.mono, fontWeight: 700, color: C.cyan, cursor: disabled ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, opacity: disabled ? 0.6 : 1, WebkitTapHighlightColor: "transparent" }}>
            Record
          </button>
          <button type="button" onClick={handleUpload} disabled={disabled}
            style={{ minHeight: 44, minWidth: 44, padding: "10px 16px", background: C.borderLight, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: C.mono, fontWeight: 600, color: C.textMid, cursor: disabled ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, opacity: disabled ? 0.6 : 1, WebkitTapHighlightColor: "transparent" }}>
            Upload
          </button>
        </>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: C.roseDim, border: `1px solid ${C.roseBorder}`, borderRadius: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: C.rose, animation: "pulse 1s infinite" }} />
            <span style={{ fontSize: 13, fontFamily: C.mono, fontWeight: 700, color: C.rose }}>Recording {fmt(duration)}</span>
          </div>
          <button type="button" onClick={stopRecording}
            style={{ minHeight: 44, padding: "10px 20px", background: C.rose, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontFamily: C.mono, fontWeight: 700, cursor: "pointer" }}>
            Stop
          </button>
        </div>
      )}
    </div>
  );
}

// ─── SECTION: DASHBOARD ───────────────────────────────────────────────────────
function Dashboard() {
  const [data, setData] = useState({ total_submissions: 0, matched: 0, recent: [] });
  useEffect(() => {
    api.get("/api/dashboard").then(setData).catch(() => setData({ total_submissions: 0, matched: 0, recent: [] }));
  }, []);
  const stats = [
    { label: "Total cases", val: data.total_submissions ?? 0, color: C.primary },
    { label: "Cases with matches", val: data.matched ?? 0, color: C.emerald },
  ];
  const recent = data.recent || [];
  return (
    <div>
      <div style={{ background: C.primaryDim, border: `1px solid ${C.primaryBorder}`, borderRadius: 8, padding: "14px 18px", marginBottom: 24, fontSize: 14, color: C.primary }}>
        <strong>Get started:</strong> Register a <strong>New Case</strong> with photos, or go to <strong>Search</strong> to match by image, text, or voice.
      </div>
      <SectionLabel label="Summary" />
      <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 12, marginBottom: 24 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `4px solid ${s.color}`, borderRadius: 6, padding: "18px 20px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize: 12, color: C.textDim, fontFamily: C.mono, marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontFamily: C.display, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.val}</div>
          </div>
        ))}
      </div>
      <SectionLabel label="Recent cases" />
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden", background: C.card, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: C.mono }}>
          <thead>
            <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
              {["Case ID", "Status", "Created", "Matches"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: C.textDim, fontWeight: 600, fontSize: 11, letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 && <tr><td colSpan={4} style={{ padding: 32, color: C.textDim, textAlign: "center" }}>No cases yet. Create one from <strong>New Case</strong>.</td></tr>}
            {recent.map((c, i) => (
              <tr key={c.id} style={{ borderBottom: i < recent.length - 1 ? `1px solid ${C.borderLight}` : "none", background: C.card }}>
                <td style={{ padding: "12px 16px", color: C.primary, fontWeight: 600 }}>{String(c.id).slice(0, 8)}…</td>
                <td style={{ padding: "12px 16px" }}><Badge label={c.status || "captured"} /></td>
                <td style={{ padding: "12px 16px", color: C.textMid }}>{c.created_at?.slice(0, 10)}</td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ color: (c.match_count || 0) > 0 ? C.emerald : C.textDim }}>{(c.match_count || 0) > 0 ? c.match_count : "—"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── IMAGE SLOTS (guided capture) ─────────────────────────────────────────────
const IMAGE_SLOTS = [
  { id: "face_frontal", label: "Face frontal", required: true },
  { id: "face_left", label: "Face left profile", required: false },
  { id: "face_right", label: "Face right profile", required: false },
  { id: "full_body", label: "Full body", required: false },
  { id: "tattoo", label: "Marks / tattoo close-up", required: false },
];

// ─── SECTION: NEW CASE ────────────────────────────────────────────────────────
function NewCase() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ district: "", ps: "", found_date: "", found_loc: "", notes: "", gender: "", age_min: "", age_max: "", build: "", skin: "", hair_color: "", beard: "", marks: "", clothing: "", manual_notes: "" });
  const [submitted, setSubmitted] = useState(false);
  const [submissionId, setSubmissionId] = useState(null);
  const [slotFiles, setSlotFiles] = useState(() => Object.fromEntries(IMAGE_SLOTS.map(s => [s.id, null])));
  const [slotPreview, setSlotPreview] = useState({});
  const [qualityMsg, setQualityMsg] = useState({});
  const [faceCondition, setFaceCondition] = useState("normal");
  const [submitError, setSubmitError] = useState(null);
  const F = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const districts = ["Ambala", "Bhiwani", "Faridabad", "Gurugram", "Hisar", "Jhajjar", "Jind", "Kaithal", "Karnal", "Kurukshetra", "Mahendragarh", "Nuh", "Palwal", "Panchkula", "Panipat", "Rewari", "Rohtak", "Sirsa", "Sonipat", "Yamunanagar"];
  const inp = (label, key, type = "text", opts = null) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono, letterSpacing: 1 }}>{label}</label>
      {opts ? (
        <select value={form[key]} onChange={e => F(key, e.target.value)} style={{ background: C.surface, border: `1px solid ${C.borderLight}`, borderRadius: 6, padding: "8px 10px", color: C.text, fontFamily: C.mono, fontSize: 12 }}>
          <option value="">— select —</option>
          {opts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={form[key]} onChange={e => F(key, e.target.value)}
          style={{ background: C.surface, border: `1px solid ${C.borderLight}`, borderRadius: 6, padding: "8px 10px", color: C.text, fontFamily: C.mono, fontSize: 12 }} />
      )}
    </div>
  );

  const addSlotFile = (slotId, file) => {
    if (!file) return;

    // 1. Basic size check
    if (file.size < 50 * 1024) {
      setQualityMsg(prev => ({ ...prev, [slotId]: "⚠️ Low quality: File size is very small. Try a closer shot." }));
    } else {
      setQualityMsg(prev => ({ ...prev, [slotId]: "Checking quality..." }));
    }

    const url = URL.createObjectURL(file);
    setSlotPreview(prev => ({ ...prev, [slotId]: url }));
    setSlotFiles(prev => ({ ...prev, [slotId]: file }));

    // 2. Advanced checks (Resolution & Brightness)
    const img = new Image();
    img.onload = () => {
      let msg = "";
      if (img.width < 640 || img.height < 480) {
        msg = "⚠️ Low resolution: Image may be too blurry for AI matching.";
      }

      // Brightness check
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = 100; canvas.height = 100; // downsample for speed
      ctx.drawImage(img, 0, 0, 100, 100);
      const imageData = ctx.getImageData(0, 0, 100, 100);
      const data = imageData.data;
      let brightness = 0;
      for (let i = 0; i < data.length; i += 4) {
        brightness += (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      }
      const avg = brightness / (data.length / 4);

      if (avg < 40) msg = "⚠️ Image is too dark. Increase lighting.";
      else if (avg > 230) msg = "⚠️ Image is overexposed. Decrease lighting.";

      if (!msg && file.size >= 50 * 1024) msg = "✓ Quality looks good.";
      setQualityMsg(prev => ({ ...prev, [slotId]: msg || qualityMsg[slotId] }));
    };
    img.src = url;
  };
  const removeSlotFile = (slotId) => {
    setSlotFiles(prev => ({ ...prev, [slotId]: null }));
    if (slotPreview[slotId]) URL.revokeObjectURL(slotPreview[slotId]);
    setSlotPreview(prev => { const n = { ...prev }; delete n[slotId]; return n; });
    setQualityMsg(prev => { const n = { ...prev }; delete n[slotId]; return n; });
  };

  const hasAtLeastOneFace = () => slotFiles.face_frontal || slotFiles.face_left || slotFiles.face_right;
  const canProceedStep1 = () => hasAtLeastOneFace();

  const doSubmit = async () => {
    setSubmitError(null);
    const entries = Object.entries(slotFiles).filter(([, f]) => f);
    if (!entries.length) { setSubmitError("Add at least one image (face frontal required)."); return; }
    const formData = new FormData();
    for (const [imageType, file] of entries) formData.append("files", file);
    formData.append("image_types", JSON.stringify(entries.map(([t]) => t)));
    formData.append("attributes_ai", JSON.stringify({ gender: form.gender || null, age_min: form.age_min || null, age_max: form.age_max || null, build: form.build || null, skin: form.skin || null, hair_color: form.hair_color || null, marks: form.marks || null, clothing: form.clothing || null }));
    formData.append("attributes_manual", JSON.stringify({ manual_notes: form.manual_notes || null, beard: form.beard || null }));
    formData.append("face_condition", faceCondition);
    try {
      const res = await api.post("/api/submissions", formData);
      setSubmissionId(res.submission_id);
      setSubmitted(true);
    } catch (e) {
      setSubmitError(e.status ? `Error ${e.status}` : (e.message || "Submit failed"));
    }
  };

  if (submitted) return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <div style={{ fontSize: 48, marginBottom: 16, color: C.emerald }}>✓</div>
      <div style={{ fontFamily: C.display, fontSize: 28, fontWeight: 800, color: C.emerald, marginBottom: 8 }}>Case Submitted</div>
      <div style={{ fontFamily: C.mono, fontSize: 13, color: C.textMid, marginBottom: 8 }}>Submission ID: <span style={{ color: C.cyan }}>{submissionId}</span></div>
      <div style={{ fontFamily: C.mono, fontSize: 11, color: C.textDim, marginBottom: 24 }}>Go to Matching to run face match against the repository.</div>
      <button onClick={() => { setSubmitted(false); setStep(1); setSubmissionId(null); setSlotFiles(Object.fromEntries(IMAGE_SLOTS.map(s => [s.id, null]))); setSlotPreview({}); setFaceCondition("normal"); }}
        style={{ background: C.amberDim, border: `1px solid ${C.amberBorder}`, color: C.amber, fontFamily: C.mono, fontSize: 12, fontWeight: 700, padding: "10px 24px", borderRadius: 6, cursor: "pointer" }}>
        + New Case
      </button>
    </div>
  );

  return (
    <div>
      <SectionLabel label="New Case — Field Capture" />
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {["1. Photos (multi-angle)", "2. Physical Attributes", "3. Review & Submit"].map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 6, background: step === i + 1 ? C.primaryDim : "transparent", border: `1px solid ${step === i + 1 ? C.primaryBorder : C.border}` }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: step > i + 1 ? C.emerald : step === i + 1 ? C.primary : C.borderLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: step === i + 1 ? "#fff" : C.text, fontWeight: 700 }}>
                {step > i + 1 ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: 11, fontFamily: C.mono, color: step === i + 1 ? C.primary : C.textDim }}>{s}</span>
            </div>
            {i < 2 && <span style={{ color: C.borderLight }}>›</span>}
          </div>
        ))}
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "24px" }}>
        {step === 1 && (
          <div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
              {IMAGE_SLOTS.map(slot => (
                <div key={slot.id} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 100, flex: 1 }}>
                    <div style={{ fontSize: 11, fontFamily: C.mono, color: C.text }}>{slot.label}{slot.required ? " *" : ""}</div>
                    {!slotFiles[slot.id] ? (
                      <ImageCaptureControl onFile={(f) => addSlotFile(slot.id, f)} />
                    ) : (
                      <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: C.emerald }}>Added</span>
                        <button type="button" onClick={() => removeSlotFile(slot.id)} style={{ fontSize: 10, color: C.rose, background: "none", border: "none", cursor: "pointer", fontFamily: C.mono }}>Remove</button>
                      </div>
                    )}
                  </div>
                  {slotPreview[slot.id] && (
                    <div style={{ width: 80, height: 80, borderRadius: 6, overflow: "hidden", border: `1px solid ${C.border}` }}>
                      <img src={slotPreview[slot.id]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  )}
                  {qualityMsg[slot.id] && <div style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono }}>{qualityMsg[slot.id]}</div>}
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono, marginRight: 8 }}>Face condition:</span>
              {["normal", "partial", "bloated", "damaged"].map(v => (
                <button key={v} type="button" onClick={() => setFaceCondition(v)} style={{ marginRight: 6, padding: "4px 10px", borderRadius: 4, border: `1px solid ${faceCondition === v ? C.primaryBorder : C.border}`, background: faceCondition === v ? C.primaryDim : "transparent", color: faceCondition === v ? C.primary : C.textDim, fontSize: 10, fontFamily: C.mono, cursor: "pointer" }}>{v}</button>
              ))}
            </div>
            <div style={{ background: C.primaryDim, border: `1px solid ${C.primaryBorder}`, borderRadius: 6, padding: "12px 14px", fontSize: 12, color: C.primary, fontFamily: C.mono }}>
              At least one face image (frontal or profile) is required. The system will run quality checks and extract face data.
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 16 }}>
            {inp("Gender", "gender", "text", ["Male", "Female", "Unknown"])}
            {inp("Est. Age Min", "age_min", "number")}
            {inp("Est. Age Max", "age_max", "number")}
            {inp("Build", "build", "text", ["Slim", "Medium", "Heavy", "Unknown"])}
            {inp("Skin Tone", "skin", "text", ["Fair", "Medium", "Dark", "Unknown"])}
            {inp("Hair Color", "hair_color", "text", ["Black", "Grey", "Brown", "White", "Unknown"])}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono, letterSpacing: 1 }}>Beard</label>
              <div style={{ display: "flex", gap: 8 }}>
                {["Yes", "No", "N/A"].map(v => (
                  <button key={v} onClick={() => F("beard", v)} style={{ flex: 1, padding: "8px", borderRadius: 6, border: `1px solid ${form.beard === v ? C.amberBorder : C.borderLight}`, background: form.beard === v ? C.amberDim : "transparent", color: form.beard === v ? C.amber : C.textDim, fontFamily: C.mono, fontSize: 11, cursor: "pointer" }}>{v}</button>
                ))}
              </div>
            </div>
            <div style={{ gridColumn: "1/-1", display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono, letterSpacing: 1 }}>Visible Marks / Scars / Tattoos</label>
              <textarea value={form.marks} onChange={e => F("marks", e.target.value)} rows={2}
                style={{ background: C.surface, border: `1px solid ${C.borderLight}`, borderRadius: 6, padding: "8px 10px", color: C.text, fontFamily: C.mono, fontSize: 12, resize: "vertical" }} />
            </div>
            <div style={{ gridColumn: "1/-1", display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono, letterSpacing: 1 }}>Clothing Description</label>
              <textarea value={form.clothing} onChange={e => F("clothing", e.target.value)} rows={2}
                style={{ background: C.surface, border: `1px solid ${C.borderLight}`, borderRadius: 6, padding: "8px 10px", color: C.text, fontFamily: C.mono, fontSize: 12, resize: "vertical" }} />
            </div>
            <div style={{ gridColumn: "1/-1", display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono, letterSpacing: 1 }}>Additional details (officer/family – not necessarily visible in photo)</label>
              <textarea value={form.manual_notes} onChange={e => F("manual_notes", e.target.value)} rows={2} placeholder="e.g. tattoo on neck per family, wearing red shirt when found"
                style={{ background: C.surface, border: `1px solid ${C.borderLight}`, borderRadius: 6, padding: "8px 10px", color: C.text, fontFamily: C.mono, fontSize: 12, resize: "vertical" }} />
            </div>
            <div style={{ gridColumn: "1/-1", background: C.cyanDim, border: `1px solid ${C.cyanBorder}`, borderRadius: 8, padding: "12px 14px", fontSize: 11, color: C.cyan, fontFamily: C.mono }}>
              AI-derived attributes from photo + officer manual notes are both stored and searchable.
            </div>
          </div>
        )}
        {step === 3 && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              {[["District", form.district || "—"], ["Police Station", form.ps || "—"], ["Date Found", form.found_date || "—"], ["Gender", form.gender || "—"], ["Age Range", form.age_min && form.age_max ? `${form.age_min}–${form.age_max} yrs` : "—"], ["Build", form.build || "—"], ["Skin", form.skin || "—"], ["Hair", form.hair_color || "—"], ["Manual notes", form.manual_notes || "—"]].map(([k, v]) => (
                <div key={k} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "10px 14px" }}>
                  <div style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono, marginBottom: 3 }}>{k}</div>
                  <div style={{ fontSize: 13, color: C.text, fontFamily: C.mono }}>{v}</div>
                </div>
              ))}
            </div>
            {submitError && <div style={{ background: C.roseDim, border: `1px solid ${C.roseBorder}`, borderRadius: 6, padding: 10, marginBottom: 12, fontSize: 11, color: C.rose }}>{submitError}</div>}
            <div style={{ background: C.roseDim, border: `1px solid ${C.roseBorder}`, borderRadius: 8, padding: "14px", fontSize: 11, color: "#fda4af", fontFamily: C.mono, marginBottom: 20 }}>
              AI outputs are investigative leads only. No court-admissible claims. Human verification required for all matches.
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
          <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}
            style={{ background: "transparent", border: `1px solid ${C.border}`, color: step === 1 ? C.textDim : C.text, fontFamily: C.mono, fontSize: 12, padding: "9px 20px", borderRadius: 6, cursor: step === 1 ? "not-allowed" : "pointer" }}>
            ← Back
          </button>
          <button
            onClick={() => step < 3 ? setStep(s => s + 1) : doSubmit()}
            disabled={step === 1 && !canProceedStep1()}
            style={{ background: C.primaryDim, border: `1px solid ${C.primaryBorder}`, color: C.primary, fontFamily: C.mono, fontSize: 12, fontWeight: 700, padding: "9px 24px", borderRadius: 6, cursor: step === 1 && !canProceedStep1() ? "not-allowed" : "pointer" }}>
            {step < 3 ? "Next →" : "Submit Case ✓"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SECTION: SEARCH (optional photo + text + voice → one Search against repository)
// ─── DETAIL MODAL ────────────────────────────────────────────────────────────
function DetailModal({ type, id, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const path = type === "submission" ? `/api/submissions/${id}` : `/api/reference_persons/${id}`;
    api.get(path)
      .then(setData)
      .catch(e => setError(e.status ? `Error ${e.status}` : "Failed to load details"))
      .finally(() => setLoading(false));
  }, [type, id]);

  if (!id) return null;

  return (
    <div className="modal-container" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div className="modal-content" style={{ background: C.card, width: "100%", maxWidth: 640, maxHeight: "90vh", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 10px 25px rgba(0,0,0,0.15)" }}>
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: C.bg }}>
          <div style={{ fontFamily: C.display, fontWeight: 700, color: C.primary, fontSize: 16 }}>
            {type === "submission" ? "Submission Details" : "Reference Person Details"}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.textDim }}>×</button>
        </div>

        <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
          {loading && <div style={{ textAlign: "center", padding: 40, color: C.textDim, fontFamily: C.mono }}>Loading...</div>}
          {error && <div style={{ padding: 12, background: C.roseDim, color: C.rose, borderRadius: 6, fontSize: 13 }}>{error}</div>}

          {data && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 300px" }}>
                  <SectionLabel label="General Info" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {[
                      ["ID", String(data.id).slice(0, 8) + "..."],
                      ["Label/Name", data.label || "N/A"],
                      ["Created", data.created_at?.slice(0, 10) || "N/A"],
                      ["Status", data.status || "N/A"],
                      ["Condition", data.face_condition || "N/A"]
                    ].filter(([, v]) => v !== "N/A").map(([k, v]) => (
                      <div key={k} style={{ background: C.bg, padding: "8px 12px", borderRadius: 6, border: `1px solid ${C.borderLight}` }}>
                        <div style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono, marginBottom: 2 }}>{k}</div>
                        <div style={{ fontSize: 12, color: C.text, fontFamily: C.mono, fontWeight: 600 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {data.photo_path && (
                  <div style={{ width: 140 }}>
                    <SectionLabel label="Reference Photo" />
                    <img src={`${API_BASE}/api/reference_files/${data.photo_path}`} alt="" style={{ width: "100%", borderRadius: 8, border: `1px solid ${C.border}` }} />
                  </div>
                )}
              </div>

              {((data.attributes_ai || data.attributes) || data.attributes_manual) && (
                <div>
                  <SectionLabel label="Attributes" />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
                    {Object.entries({ ...(data.attributes_ai || data.attributes || {}), ...(data.attributes_manual || {}) })
                      .filter(([, v]) => v != null && v !== "" && v !== "Unknown")
                      .map(([k, v]) => (
                        <div key={k} style={{ border: `1px solid ${C.borderLight}`, padding: "8px 10px", borderRadius: 6, background: C.card }}>
                          <div style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono, textTransform: "capitalize" }}>{k.replace(/_/g, " ")}</div>
                          <div style={{ fontSize: 12, color: C.text, fontFamily: C.mono, fontWeight: 500 }}>{String(v)}</div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {data.images && data.images.length > 0 && (
                <div>
                  <SectionLabel label={`Submission Photos (${data.images.length})`} />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 12 }}>
                    {data.images.map(img => (
                      <div key={img.id} style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${C.borderLight}`, background: C.bg }}>
                        <img src={`${API_BASE}/api/files/${img.path}`} alt="" style={{ width: "100%", height: 100, objectFit: "cover" }} />
                        <div style={{ padding: 4, fontSize: 9, fontFamily: C.mono, textAlign: "center", color: C.textDim }}>{img.image_type.replace(/_/g, " ")}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: "16px 24px", borderTop: `1px solid ${C.border}`, textAlign: "right", background: C.bg }}>
          <button onClick={onClose} style={{ padding: "8px 20px", background: C.primary, color: "#fff", border: "none", borderRadius: 6, fontFamily: C.mono, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Close</button>
        </div>
      </div>
    </div>
  );
}

function SearchTab() {
  const [photo, setPhoto] = useState(null);
  const [description, setDescription] = useState("");
  const [voice, setVoice] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [selected, setSelected] = useState(null);
  const [detailView, setDetailView] = useState(null); // { type, id }
  const [feedback, setFeedback] = useState({});
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(null);
  const [error, setError] = useState(null);

  const hasInput = photo || (description || "").trim() || voice;

  const runSearch = async () => {
    if (!hasInput) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      if (photo) formData.append("files", photo);
      if (description.trim()) formData.append("query", description.trim());
      if (voice) formData.append("audio", voice);
      const res = await fetch(`${API_BASE}/api/search/combined`, { method: "POST", body: formData });
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      setTranscript(data.transcript || "");
      setResults((data.results || []).map(r => ({
        id: r.id,
        label: r.label,
        photo_path: r.photo_path,
        score: r.score ?? 0,
        overlap: r.overlap ?? 0,
        sources: r.sources || [],
        match_count: r.match_count,
        matched_by: r.matched_by
      })));
    } catch (e) {
      setError(e.message || "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async (matchId) => {
    const v = feedback[`${matchId}_verdict`]; const f = feedback[`${matchId}_face_assessment`]; const a = feedback[`${matchId}_action`]; const n = feedback[`${matchId}_notes`];
    if (!v || !a) return;
    try {
      await api.post("/api/feedback", { match_id: matchId, verdict: v, face_assessment: f || null, action_taken: a, notes: n || null });
      setFeedbackSubmitted(matchId);
      setTimeout(() => setFeedbackSubmitted(null), 3000);
    } catch (_) { }
  };

  return (
    <div>
      <SectionLabel label="Search repository" />
      {detailView && <DetailModal type={detailView.type} id={detailView.id} onClose={() => setDetailView(null)} />}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, color: C.textDim, fontFamily: C.mono, marginBottom: 6 }}>Photo (optional)</label>
            {!photo ? (
              <ImageCaptureControl onFile={setPhoto} />
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: C.emerald, fontFamily: C.mono }}>{photo.name}</span>
                <button type="button" onClick={() => setPhoto(null)} style={{ fontSize: 11, color: C.rose, background: "none", border: "none", cursor: "pointer", fontFamily: C.mono }}>Remove</button>
              </div>
            )}
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: C.textDim, fontFamily: C.mono, marginBottom: 6 }}>Description (optional)</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. male, 25–30, tattoo on neck"
              style={{ width: "100%", boxSizing: "border-box", background: C.surface, border: `1px solid ${C.borderLight}`, borderRadius: 6, padding: "10px 12px", color: C.text, fontFamily: C.mono, fontSize: 12 }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: C.textDim, fontFamily: C.mono, marginBottom: 6 }}>Voice note (optional) — will be transcribed</label>
            {!voice ? (
              <VoiceCaptureControl onFile={setVoice} />
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: C.emerald, fontFamily: C.mono }}>{voice.name}</span>
                <button type="button" onClick={() => setVoice(null)} style={{ fontSize: 11, color: C.rose, background: "none", border: "none", cursor: "pointer", fontFamily: C.mono }}>Remove</button>
              </div>
            )}
          </div>
          <button onClick={runSearch} disabled={!hasInput || loading}
            style={{ padding: "12px 24px", background: hasInput ? C.emerald : C.border, color: "#fff", border: "none", fontFamily: C.mono, fontSize: 13, fontWeight: 700, borderRadius: 6, cursor: hasInput && !loading ? "pointer" : "not-allowed" }}>
            {loading ? "Searching…" : "Search"}
          </button>
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 11, color: C.textDim, fontFamily: C.mono }}>Add any combination of photo, text, or voice. Search runs all of them against the repository and shows matches by overlap and confidence.</p>
      </div>

      {transcript && <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: 10, marginBottom: 12, fontSize: 11, color: C.textMid, fontFamily: C.mono }}>Voice transcript: “{transcript}”</div>}
      {error && <div style={{ background: C.roseDim, border: `1px solid ${C.roseBorder}`, borderRadius: 6, padding: 8, marginBottom: 12, fontSize: 11, color: C.rose }}>{error}</div>}
      {results.length === 0 && !loading && (
        <div style={{ padding: 24, textAlign: "center", color: C.textDim, fontFamily: C.mono, fontSize: 12 }}>Add at least one: photo, description, or voice note, then click Search.</div>
      )}

      <div style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono, marginBottom: 8 }}>Results ({results.length})</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {results.map((r, idx) => {
          const score = r.score ?? 0;
          const hasFeedback = !!r.match_id;
          const overlap = r.overlap ?? 0;
          const sources = r.sources || [];
          const matchCount = r.match_count ?? 0;
          return (
            <div key={r.match_id || r.id || idx} style={{ border: `1px solid ${selected === (r.match_id || r.id) ? C.cyanBorder : C.border}`, borderRadius: 10, overflow: "hidden", background: C.card, transition: "border-color 0.2s" }}>
              <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                {matchCount > 0 && (
                  <div style={{ padding: "4px 10px", borderRadius: 6, background: C.cyanDim, border: `1px solid ${C.cyanBorder}`, fontSize: 11, fontFamily: C.mono, fontWeight: 700, color: C.cyan }}>
                    {matchCount} case{matchCount !== 1 ? "s" : ""}
                  </div>
                )}
                {overlap > 0 && matchCount === 0 && (
                  <div style={{ padding: "4px 10px", borderRadius: 6, background: overlap >= 2 ? C.emeraldDim : C.amberDim, border: `1px solid ${overlap >= 2 ? C.emerald : C.amber}`, fontSize: 11, fontFamily: C.mono, fontWeight: 700, color: overlap >= 2 ? C.emerald : C.amber }}>
                    {overlap}/3 {sources.length ? `(${sources.join("+")})` : ""}
                  </div>
                )}
                {r.rank != null && (
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: score > 0.85 ? C.emeraldDim : score > 0.7 ? C.amberDim : C.roseDim, border: `2px solid ${score > 0.85 ? C.emerald : score > 0.7 ? C.amber : C.rose}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: C.display, fontSize: 18, fontWeight: 800, color: score > 0.85 ? C.emerald : score > 0.7 ? C.amber : C.rose }}>
                    #{r.rank}
                  </div>
                )}
                {r.photo_path && <img src={`${API_BASE}/api/reference_files/${r.photo_path}`} alt="" style={{ width: 48, height: 48, borderRadius: 6, objectFit: "cover" }} />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: C.text, fontFamily: C.mono, fontWeight: 600 }}>{r.label}</div>
                  {r.id && <div style={{ fontSize: 11, color: C.textDim, fontFamily: C.mono, marginTop: 3 }}>{r.id}</div>}
                  {(r.matched_by || []).length > 0 && (
                    <div style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono, marginTop: 4 }}>
                      Matched by: {(r.matched_by || []).slice(0, 3).map(m => `${(m.submission_id || "").slice(0, 8)} (${((m.score || 0) * 100).toFixed(0)}%)`).join(", ")}{(r.matched_by || []).length > 3 ? "…" : ""}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right", display: "flex", alignItems: "center", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 24, fontFamily: C.display, fontWeight: 800, color: score > 0.85 ? C.emerald : score > 0.7 ? C.amber : C.rose }}>
                      {(score * 100).toFixed(0)}%
                    </div>
                    <div style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono }}>{hasFeedback ? "Face score" : "Confidence"}</div>
                  </div>
                  <button onClick={() => setDetailView({ type: (r.sources && r.sources.length > 0) || r.match_count > 0 || r.matched_by ? "reference" : "submission", id: r.id })}
                    style={{ background: "transparent", border: `1px solid ${C.cyan}`, color: C.cyan, borderRadius: 6, padding: "6px 12px", fontFamily: C.mono, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    Details
                  </button>
                  {hasFeedback && (
                    <button onClick={() => setSelected(selected === (r.match_id || r.id) ? null : (r.match_id || r.id))}
                      style={{ background: "none", border: "none", color: C.textDim, fontSize: 12, cursor: "pointer", padding: 8 }}>
                      {selected === (r.match_id || r.id) ? "▲" : "▼"}
                    </button>
                  )}
                </div>
              </div>

              {hasFeedback && selected === (r.match_id || r.id) && (
                <div style={{ borderTop: `1px solid ${C.border}`, padding: "20px", background: C.bg }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
                    <div>
                      <div style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono, letterSpacing: 1, marginBottom: 12 }}>AI SCORE</div>
                      <ScoreBar value={score} color={C.cyan} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono, letterSpacing: 1, marginBottom: 12 }}>INVESTIGATOR FEEDBACK</div>
                      {feedbackSubmitted === r.match_id ? (
                        <div style={{ padding: "20px", textAlign: "center", color: C.emerald, fontFamily: C.mono, fontSize: 13 }}>✓ Feedback saved</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {[["verdict", "Verdict", ["correct_match", "incorrect_match", "possible_match", "needs_more_info"]], ["face_assessment", "Face", ["strong_match", "weak_match", "no_match", "not_visible"]], ["action", "Action", ["referred_forensics", "referred_family", "further_investigation", "case_closed", "none"]]].map(([key, label, opts]) => (
                            <div key={key}>
                              <div style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono, marginBottom: 4 }}>{label}</div>
                              <select value={feedback[`${r.match_id}_${key}`] || ""} onChange={e => setFeedback(f => ({ ...f, [`${r.match_id}_${key}`]: e.target.value }))}
                                style={{ width: "100%", background: C.surface, border: `1px solid ${C.borderLight}`, borderRadius: 6, padding: "7px 10px", color: C.text, fontFamily: C.mono, fontSize: 11 }}>
                                <option value="">— select —</option>
                                {opts.map(o => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
                              </select>
                            </div>
                          ))}
                          <div>
                            <div style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono, marginBottom: 4 }}>Notes</div>
                            <textarea rows={2} value={feedback[`${r.match_id}_notes`] || ""} onChange={e => setFeedback(f => ({ ...f, [`${r.match_id}_notes`]: e.target.value }))}
                              style={{ width: "100%", background: C.surface, border: `1px solid ${C.borderLight}`, borderRadius: 6, padding: "7px 10px", color: C.text, fontFamily: C.mono, fontSize: 11, resize: "vertical", boxSizing: "border-box" }} />
                          </div>
                          <button onClick={() => submitFeedback(r.match_id)}
                            style={{ background: C.cyanDim, border: `1px solid ${C.cyanBorder}`, color: C.cyan, fontFamily: C.mono, fontSize: 11, fontWeight: 700, padding: "9px", borderRadius: 6, cursor: "pointer" }}>
                            Submit feedback →
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ background: C.roseDim, border: `1px solid ${C.roseBorder}`, borderRadius: 6, padding: "10px 14px", fontSize: 11, color: "#fda4af", fontFamily: C.mono }}>
                    All scores are probabilistic. Human verification required.
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ─── SECTION: SCHEMAS ─────────────────────────────────────────────────────────
function Schemas() {
  const [tab, setTab] = useState("pg");
  const [expanded, setExpanded] = useState({});
  const toggle = k => setExpanded(e => ({ ...e, [k]: !e[k] }));

  return (
    <div>
      <SectionLabel label="Data Schemas" />
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[["pg", "PostgreSQL Tables"], ["qdrant", "Qdrant Collections"], ["blob", "Blob Storage"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: "8px 16px", borderRadius: 6, border: `1px solid ${tab === k ? C.amberBorder : C.border}`, background: tab === k ? C.amberDim : "transparent", color: tab === k ? C.amber : C.textDim, fontFamily: C.mono, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{l}</button>
        ))}
      </div>

      {tab === "pg" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {PG_TABLES.map(t => (
            <div key={t.name} style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", background: C.card }}>
              <div onClick={() => toggle(t.name)} style={{ padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, background: C.bg }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: t.color }} />
                <span style={{ fontFamily: C.mono, fontSize: 14, fontWeight: 700, color: t.color }}>{t.name}</span>
                <span style={{ fontSize: 11, color: C.textDim, fontFamily: C.mono, flex: 1 }}>{t.desc}</span>
                <span style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono }}>{t.cols.length} cols</span>
                <span style={{ color: C.textDim, fontSize: 12 }}>{expanded[t.name] ? "▲" : "▼"}</span>
              </div>
              {expanded[t.name] && (
                <div style={{ borderTop: `1px solid ${C.border}`, overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: C.mono }}>
                    <thead>
                      <tr style={{ background: "rgba(0,0,0,0.3)" }}>
                        {["Column", "Type", "Constraint", "Description"].map(h => (
                          <th key={h} style={{ padding: "8px 14px", textAlign: "left", color: C.textDim, fontSize: 10, letterSpacing: 1, fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {t.cols.map((c, i) => (
                        <tr key={c.col} style={{ borderTop: `1px solid ${C.borderLight}`, background: i % 2 === 0 ? "transparent" : C.bg }}>
                          <td style={{ padding: "8px 14px", color: t.color, fontWeight: 600, whiteSpace: "nowrap" }}>{c.col}</td>
                          <td style={{ padding: "8px 14px", color: "#a78bfa", whiteSpace: "nowrap" }}>{c.type}</td>
                          <td style={{ padding: "8px 14px", color: C.amber, fontSize: 10, whiteSpace: "nowrap" }}>{c.constraint}</td>
                          <td style={{ padding: "8px 14px", color: C.textMid }}>{c.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "qdrant" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {QDRANT_COLLECTIONS.map(col => (
            <div key={col.name} style={{ border: `1px solid ${C.border}`, borderRadius: 10, background: C.card, overflow: "hidden" }}>
              <div style={{ padding: "18px 20px", borderBottom: `1px solid ${C.border}`, background: C.bg, display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono, marginBottom: 4 }}>COLLECTION</div>
                  <div style={{ fontFamily: C.mono, fontSize: 16, fontWeight: 700, color: col.color }}>{col.name}</div>
                </div>
                {[["Model", col.model], ["Dimensions", col.dims], ["Distance", col.distance]].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono, marginBottom: 4 }}>{k}</div>
                    <div style={{ fontFamily: C.mono, fontSize: 12, color: C.text }}>{v}</div>
                  </div>
                ))}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono, marginBottom: 4 }}>PURPOSE</div>
                  <div style={{ fontFamily: C.mono, fontSize: 11, color: C.textMid }}>{col.desc}</div>
                </div>
              </div>
              <div style={{ padding: "16px 20px" }}>
                <div style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono, letterSpacing: 1, marginBottom: 10 }}>PAYLOAD SCHEMA</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: C.mono }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {["Key", "Type", "Description"].map(h => <th key={h} style={{ padding: "6px 12px", textAlign: "left", color: C.textDim, fontSize: 10, letterSpacing: 1 }}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {col.payload.map((p, i) => (
                      <tr key={p.key} style={{ borderTop: `1px solid ${C.borderLight}`, background: i % 2 === 0 ? "transparent" : C.bg }}>
                        <td style={{ padding: "7px 12px", color: col.color, fontWeight: 600 }}>{p.key}</td>
                        <td style={{ padding: "7px 12px", color: "#a78bfa" }}>{p.type}</td>
                        <td style={{ padding: "7px 12px", color: C.textMid }}>{p.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "blob" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {BLOB_STRUCTURE.map(b => (
            <div key={b.container} style={{ border: `1px solid ${C.border}`, borderRadius: 10, background: C.card, overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, background: C.bg, display: "flex", gap: 20, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono, marginBottom: 3 }}>CONTAINER</div>
                  <div style={{ fontFamily: C.mono, fontSize: 14, fontWeight: 700, color: C.sky }}>{b.container}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono, marginBottom: 3 }}>ACCESS</div>
                  <div style={{ fontFamily: C.mono, fontSize: 11, color: C.amber }}>{b.access}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono, marginBottom: 3 }}>LIFECYCLE</div>
                  <div style={{ fontFamily: C.mono, fontSize: 11, color: C.textMid }}>{b.tier}</div>
                </div>
              </div>
              <div style={{ padding: "14px 20px" }}>
                {b.paths.map(p => (
                  <div key={p.path} style={{ padding: "10px 14px", borderLeft: `2px solid ${C.borderLight}`, marginBottom: 8, background: C.bg, borderRadius: "0 6px 6px 0" }}>
                    <div style={{ fontFamily: C.mono, fontSize: 11, color: C.sky, marginBottom: 3, wordBreak: "break-all" }}>{p.path}</div>
                    <div style={{ fontFamily: C.mono, fontSize: 10, color: C.textDim }}>{p.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SECTION: AUDIT LOG ───────────────────────────────────────────────────────
function AuditLog() {
  const [entries, setEntries] = useState([]);
  useEffect(() => {
    api.get("/api/audit").then(setEntries).catch(() => setEntries([]));
  }, []);
  const actionColor = (a) => {
    if (!a) return C.textDim;
    if (a.startsWith("ai.")) return C.violet;
    if (a.includes("confirm") || a.includes("resolve")) return C.emerald;
    if (a.includes("create")) return C.cyan;
    if (a.includes("feedback")) return C.amber;
    if (a.includes("match")) return C.cyan;
    return C.amber;
  };
  return (
    <div>
      <SectionLabel label="Audit Log — Immutable Trail" />
      <div style={{ background: C.roseDim, border: `1px solid ${C.roseBorder}`, borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 11, color: "#fda4af", fontFamily: C.mono }}>
        INSERT-only. Every submission, match, and feedback is recorded with timestamp.
      </div>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: C.mono }}>
          <thead>
            <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
              {["Timestamp", "User", "Action", "Resource", "IP"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: C.textDim, fontSize: 10, letterSpacing: 1, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && <tr><td colSpan={5} style={{ padding: 24, color: C.textDim, textAlign: "center" }}>No audit entries yet</td></tr>}
            {entries.map((a, i) => (
              <tr key={a.id || i} style={{ borderBottom: `1px solid ${C.borderLight}`, background: i % 2 === 0 ? "transparent" : C.bg }}>
                <td style={{ padding: "9px 14px", color: C.textDim, whiteSpace: "nowrap" }}>{a.created_at}</td>
                <td style={{ padding: "9px 14px", color: C.text, whiteSpace: "nowrap" }}>{a.user_id || "—"}</td>
                <td style={{ padding: "9px 14px", whiteSpace: "nowrap" }}>
                  <span style={{ color: actionColor(a.action), fontWeight: 600 }}>{a.action}</span>
                </td>
                <td style={{ padding: "9px 14px", color: C.cyan }}>{a.resource_id ? String(a.resource_id).slice(0, 8) + "…" : "—"}</td>
                <td style={{ padding: "9px 14px", color: C.textDim }}>{a.ip_address || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── USER MANAGEMENT (ADMIN) ──────────────────────────────────────────────────
const ROLES = ["field_officer", "investigator", "supervisor", "admin"];

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [addForm, setAddForm] = useState({ username: "", password: "", name: "", role: "field_officer" });
  const [editForm, setEditForm] = useState({ name: "", role: "", is_active: true, password: "" });

  const load = () => {
    setLoading(true);
    api.get("/api/admin/users").then((data) => { setUsers(Array.isArray(data) ? data : []); setError(""); }).catch((r) => { setUsers([]); setError(r.status ? `Error ${r.status}` : "Failed to load"); }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/api/admin/users", { username: addForm.username.trim(), password: addForm.password, name: addForm.name.trim(), role: addForm.role });
      setAddOpen(false);
      setAddForm({ username: "", password: "", name: "", role: "field_officer" });
      load();
    } catch (r) {
      const data = await r.json?.().catch(() => ({}));
      setError(data.detail || (r.status ? `Error ${r.status}` : "Failed to create"));
    }
  };

  const openEdit = (u) => {
    setEditId(u.id);
    setEditForm({ name: u.name, role: u.role, is_active: u.is_active, password: "" });
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editId) return;
    setError("");
    try {
      const body = { name: editForm.name.trim(), role: editForm.role, is_active: editForm.is_active };
      if (editForm.password.trim()) body.password = editForm.password;
      await api.patch(`/api/admin/users/${editId}`, body);
      setEditId(null);
      load();
    } catch (r) {
      const data = await r.json?.().catch(() => ({}));
      setError(data.detail || (r.status ? `Error ${r.status}` : "Failed to update"));
    }
  };

  return (
    <div>
      <SectionLabel label="User Management" />
      <div style={{ background: C.primaryDim, border: `1px solid ${C.primaryBorder}`, borderRadius: 8, padding: "14px 18px", marginBottom: 24, fontSize: 14, color: C.primary }}>
        Add and edit users. Only admins can access this page.
      </div>
      {error && <div style={{ marginBottom: 12, padding: "10px 14px", background: C.roseDim, border: `1px solid ${C.roseBorder}`, borderRadius: 6, fontSize: 12, color: C.rose }}>{error}</div>}
      <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={() => { setAddOpen(true); setError(""); }}
          style={{ padding: "10px 20px", background: C.emerald, color: "#fff", border: "none", borderRadius: 6, fontFamily: C.mono, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          + Add user
        </button>
      </div>

      {addOpen && (
        <div style={{ marginBottom: 24, padding: 20, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, marginBottom: 16 }}>New user</div>
          <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 400 }}>
            <div>
              <label style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono }}>Username</label>
              <input type="text" value={addForm.username} onChange={(e) => setAddForm((f) => ({ ...f, username: e.target.value }))} required
                style={{ width: "100%", boxSizing: "border-box", marginTop: 4, padding: "8px 10px", border: `1px solid ${C.borderLight}`, borderRadius: 6, fontFamily: C.mono, fontSize: 12 }} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono }}>Password</label>
              <input type="password" value={addForm.password} onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))} required
                style={{ width: "100%", boxSizing: "border-box", marginTop: 4, padding: "8px 10px", border: `1px solid ${C.borderLight}`, borderRadius: 6, fontFamily: C.mono, fontSize: 12 }} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono }}>Name</label>
              <input type="text" value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} required
                style={{ width: "100%", boxSizing: "border-box", marginTop: 4, padding: "8px 10px", border: `1px solid ${C.borderLight}`, borderRadius: 6, fontFamily: C.mono, fontSize: 12 }} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono }}>Role</label>
              <select value={addForm.role} onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value }))}
                style={{ width: "100%", marginTop: 4, padding: "8px 10px", border: `1px solid ${C.borderLight}`, borderRadius: 6, fontFamily: C.mono, fontSize: 12 }}>
                {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" style={{ padding: "9px 18px", background: C.primary, color: "#fff", border: "none", borderRadius: 6, fontFamily: C.mono, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Create</button>
              <button type="button" onClick={() => { setAddOpen(false); setError(""); }} style={{ padding: "9px 18px", background: C.borderLight, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: C.mono, fontSize: 12, cursor: "pointer" }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", background: C.card }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: C.mono }}>
          <thead>
            <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
              {["Username", "Name", "Role", "District", "Station", "Active", "Created", ""].map((h) => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: C.textDim, fontWeight: 600, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} style={{ padding: 24, color: C.textDim, textAlign: "center" }}>Loading…</td></tr>}
            {!loading && users.length === 0 && <tr><td colSpan={8} style={{ padding: 24, color: C.textDim, textAlign: "center" }}>No users</td></tr>}
            {!loading && users.map((u) => (
              <tr key={u.id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                <td style={{ padding: "10px 14px", fontWeight: 600 }}>{u.username}</td>
                <td style={{ padding: "10px 14px" }}>{u.name}</td>
                <td style={{ padding: "10px 14px" }}><Badge label={u.role} /></td>
                <td style={{ padding: "10px 14px", color: C.textDim }}>{u.district || "—"}</td>
                <td style={{ padding: "10px 14px", color: C.textDim }}>{u.station || "—"}</td>
                <td style={{ padding: "10px 14px" }}>{u.is_active ? "Yes" : "No"}</td>
                <td style={{ padding: "10px 14px", color: C.textDim }}>{u.created_at ? u.created_at.slice(0, 10) : "—"}</td>
                <td style={{ padding: "10px 14px" }}>
                  {editId === u.id ? null : (
                    <button type="button" onClick={() => openEdit(u)} style={{ fontSize: 11, color: C.cyan, background: "none", border: "none", cursor: "pointer", fontFamily: C.mono }}>Edit</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editId && (
        <div style={{ marginTop: 24, padding: 20, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, marginBottom: 16 }}>Edit user</div>
          <form onSubmit={handleEdit} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 400 }}>
            <div>
              <label style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono }}>Name</label>
              <input type="text" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} required
                style={{ width: "100%", boxSizing: "border-box", marginTop: 4, padding: "8px 10px", border: `1px solid ${C.borderLight}`, borderRadius: 6, fontFamily: C.mono, fontSize: 12 }} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono }}>Role</label>
              <select value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                style={{ width: "100%", marginTop: 4, padding: "8px 10px", border: `1px solid ${C.borderLight}`, borderRadius: 6, fontFamily: C.mono, fontSize: 12 }}>
                {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" id="edit-active" checked={editForm.is_active} onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.checked }))} />
              <label htmlFor="edit-active" style={{ fontSize: 12, fontFamily: C.mono }}>Active</label>
            </div>
            <div>
              <label style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono }}>New password (leave blank to keep)</label>
              <input type="password" value={editForm.password} onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                style={{ width: "100%", boxSizing: "border-box", marginTop: 4, padding: "8px 10px", border: `1px solid ${C.borderLight}`, borderRadius: 6, fontFamily: C.mono, fontSize: 12 }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" style={{ padding: "9px 18px", background: C.primary, color: "#fff", border: "none", borderRadius: 6, fontFamily: C.mono, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Save</button>
              <button type="button" onClick={() => { setEditId(null); setError(""); }} style={{ padding: "9px 18px", background: C.borderLight, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: C.mono, fontSize: 12, cursor: "pointer" }}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(() => getStoredUser());
  const [tab, setTab] = useState("dashboard");

  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener("ubis-unauthorized", onUnauthorized);
    return () => window.removeEventListener("ubis-unauthorized", onUnauthorized);
  }, []);

  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "newcase", label: "New Case" },
    { id: "search", label: "Search" },
    { id: "schemas", label: "Schemas" },
    { id: "audit", label: "Audit Log" },
    ...(user?.role === "admin" ? [{ id: "admin", label: "User Management" }] : []),
  ];

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg }}>
        <style>{FONTS}</style>
        <Login onSuccess={(u) => setUser(u)} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: C.mono }}>
      <style>{FONTS}</style>

      {/* Top Bar */}
      <div className="top-bar" style={{ background: C.primary, color: "#fff", padding: "0 24px", display: "flex", alignItems: "center", gap: 0, overflowX: "auto", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
        <div className="top-bar-logo" style={{ display: "flex", alignItems: "center", gap: 12, paddingRight: 24, borderRight: "1px solid rgba(255,255,255,0.2)", marginRight: 20, minWidth: "fit-content" }}>
          <span style={{ fontFamily: C.display, fontSize: 18, fontWeight: 700, letterSpacing: 0.5, whiteSpace: "nowrap" }}>UBIS</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", letterSpacing: 1.5 }}>HARYANA POLICE</span>
        </div>
        <div className="top-bar-tabs" style={{ display: "flex", alignItems: "center" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: "transparent", border: "none", borderBottom: `3px solid ${tab === t.id ? "#fff" : "transparent"}`,
              color: tab === t.id ? "#fff" : "rgba(255,255,255,0.8)", fontFamily: C.mono, fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
              padding: "16px 18px", cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s",
            }}>{t.label}</button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.9)" }}>{user.name || user.username || "—"}</span>
          <button type="button" onClick={() => { clearAuth(); setUser(null); }} style={{ fontSize: 11, color: "rgba(255,255,255,0.9)", background: "transparent", border: "1px solid rgba(255,255,255,0.5)", borderRadius: 4, padding: "6px 12px", fontFamily: C.mono, cursor: "pointer" }}>Logout</button>
        </div>
      </div>

      {/* Content */}
      <div className="main-content" style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>
        {tab === "dashboard" && <Dashboard />}
        {tab === "newcase" && <NewCase />}
        {tab === "search" && <SearchTab />}
        {tab === "schemas" && <Schemas />}
        {tab === "audit" && <AuditLog />}
        {tab === "admin" && <UserManagement />}
      </div>

      <div style={{ textAlign: "center", padding: "14px", borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.textDim, fontFamily: C.mono, background: C.surface }}>
        UBIS Phase 1 MVP · Nagarro × Haryana Police · AI outputs are investigative leads only; human verification required.
      </div>
    </div>
  );
}
