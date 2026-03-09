"""
Qdrant client for face embeddings. Local/self-hosted only.
"""
from typing import List, Dict, Any, Optional
import uuid as uuid_lib
import numpy as np

from app.config import QDRANT_URL, QDRANT_COLLECTION, EMBEDDING_DIM

try:
    from qdrant_client import QdrantClient
    from qdrant_client.models import PointStruct, Filter, FieldCondition, MatchValue
except ImportError:
    QdrantClient = None
    PointStruct = None
    Filter = None
    FieldCondition = None
    MatchValue = None

_client: Optional[Any] = None


def get_client():
    global _client
    if _client is None and QdrantClient is not None:
        try:
            if QDRANT_URL == ":memory:":
                _client = QdrantClient(":memory:")
            elif "://" not in QDRANT_URL:
                # Local path (no Docker): persistent storage in ./qdrant_data or similar
                _client = QdrantClient(path=QDRANT_URL)
            else:
                _client = QdrantClient(url=QDRANT_URL)
        except Exception:
            _client = None
    return _client


def ensure_collection():
    """Create collection if not exists."""
    client = get_client()
    if client is None:
        return
    from qdrant_client.models import Distance, VectorParams
    try:
        client.get_collection(QDRANT_COLLECTION)
    except Exception:
        client.create_collection(
            collection_name=QDRANT_COLLECTION,
            vectors_config=VectorParams(size=EMBEDDING_DIM, distance=Distance.COSINE),
        )


def upsert_points(points: List[Dict[str, Any]]) -> None:
    """Upsert embedding points. Each dict: id, vector, payload (submission_id, image_id, image_type, is_missing_person, etc.)."""
    client = get_client()
    if client is None or not points:
        return
    ensure_collection()
    structs = [
        PointStruct(
            id=p["id"],
            vector=p["vector"].tolist() if hasattr(p["vector"], "tolist") else p["vector"],
            payload=p["payload"],
        )
        for p in points
    ]
    client.upsert(collection_name=QDRANT_COLLECTION, points=structs)


def search_reference_only(vector: np.ndarray, limit: int = 20) -> List[Dict]:
    """Search only reference persons (is_missing_person=true). Returns list of {id, score, payload}."""
    client = get_client()
    if client is None:
        return []
    ensure_collection()
    from qdrant_client.models import Filter, FieldCondition, MatchValue
    vec = vector.tolist() if hasattr(vector, "tolist") else vector
    result = client.query_points(
        collection_name=QDRANT_COLLECTION,
        query=vec,
        query_filter=Filter(must=[FieldCondition(key="is_missing_person", match=MatchValue(value=True))]),
        limit=limit,
    )
    points = result.points if hasattr(result, "points") else []
    return [{"id": r.id, "score": r.score, "payload": r.payload or {}} for r in points]


def search_all(vector: np.ndarray, limit: int = 20) -> List[Dict]:
    """Search without filter (e.g. for aggregation)."""
    client = get_client()
    if client is None:
        return []
    ensure_collection()
    vec = vector.tolist() if hasattr(vector, "tolist") else vector
    result = client.query_points(
        collection_name=QDRANT_COLLECTION,
        query=vec,
        limit=limit,
    )
    points = result.points if hasattr(result, "points") else []
    return [{"id": r.id, "score": r.score, "payload": r.payload or {}} for r in points]


def get_vectors_by_submission(submission_id: str) -> List[Dict]:
    """Scroll and return all points for a submission (for multi-angle match)."""
    client = get_client()
    if client is None:
        return []
    ensure_collection()
    from qdrant_client.models import Filter, FieldCondition, MatchValue
    points, _ = client.scroll(
        collection_name=QDRANT_COLLECTION,
        scroll_filter=Filter(must=[
            FieldCondition(key="submission_id", match=MatchValue(value=submission_id)),
            FieldCondition(key="is_missing_person", match=MatchValue(value=False)),
        ]),
        with_payload=True,
        with_vectors=True,
        limit=50,
    )
    return [{"id": p.id, "vector": p.vector, "payload": p.payload or {}} for p in points]
