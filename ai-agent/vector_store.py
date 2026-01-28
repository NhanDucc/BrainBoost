from typing import List, Dict
import os
from dotenv import load_dotenv
import chromadb

load_dotenv()

CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
CHROMA_COLLECTION_NAME = os.getenv("CHROMA_COLLECTION_NAME", "brainboost_lessons")

_client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)
_collection = _client.get_or_create_collection(
    name=CHROMA_COLLECTION_NAME,
    metadata={"hnsw:space": "cosine"},  # dùng cosine similarity
)


def save_lesson_vectors(lesson_id: str, chunks: List[Dict]) -> None:
    """
    Lưu embedding các chunk vào ChromaDB.
    """
    if not chunks:
        return

    ids = []
    documents = []
    embeddings = []
    metadatas = []

    for ch in chunks:
        idx = ch.get("index")
        text = ch.get("text")
        emb = ch.get("embedding")

        if text is None or emb is None:
            continue

        doc_id = f"{lesson_id}::chunk::{idx}"
        ids.append(doc_id)
        documents.append(text)
        embeddings.append(emb)
        metadatas.append(
            {
                "lesson_id": lesson_id,
                "chunk_index": idx,
            }
        )

    if not ids:
        return

    _collection.upsert(
        ids=ids,
        documents=documents,
        embeddings=embeddings,
        metadatas=metadatas,
    )


def load_lesson_vectors(lesson_id: str) -> List[Dict]:
    """
    Load các chunk đã embed cho 1 lesson_id từ ChromaDB.
    Trả về list[{"index", "text", "embedding"}].
    """
    if not lesson_id:
        return []

    try:
        results = _collection.get(
            where={"lesson_id": lesson_id},
            include=["embeddings", "documents", "metadatas"],
        )
    except Exception:
        return []

    ids = results.get("ids") or []
    if not ids:
        return []

    # ⚠ KHÔNG dùng "or []" trên embeddings vì có thể là numpy array
    embeddings_raw = results.get("embeddings")
    documents = results.get("documents") or []
    metadatas = results.get("metadatas") or []

    if embeddings_raw is None:
        embeddings_list = []
    else:
        # Ép về list để tránh lỗi truth value ambiguous
        embeddings_list = list(embeddings_raw)

    chunks: List[Dict] = []

    for i, _id in enumerate(ids):
        text = documents[i] if i < len(documents) else ""
        emb_raw = embeddings_list[i] if i < len(embeddings_list) else []

        # đảm bảo emb là list[float], không phải numpy array
        try:
            emb = list(emb_raw)
        except TypeError:
            emb = emb_raw

        meta = metadatas[i] if i < len(metadatas) else {}

        if not text or not emb:
            continue

        chunks.append(
            {
                "index": meta.get("chunk_index", i),
                "text": text,
                "embedding": emb,
            }
        )

    # Sắp xếp lại theo index cho dễ debug
    chunks.sort(key=lambda ch: ch.get("index", 0))
    return chunks
