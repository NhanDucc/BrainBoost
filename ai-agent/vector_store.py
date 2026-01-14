# ai-agent/vector_store.py
import os
import json
from typing import List, Dict, Optional

# Thư mục lưu "vector DB" đơn giản (file JSON per lesson)
VECTOR_STORE_DIR = os.getenv("VECTOR_STORE_DIR", "vector_store")

os.makedirs(VECTOR_STORE_DIR, exist_ok=True)


def _safe_lesson_id(lesson_id: str) -> str:
    """
    Chuẩn hóa lesson_id để dùng làm tên file.
    Ví dụ: "course123::0-1" -> "course123__0-1"
    """
    return lesson_id.replace("/", "_").replace("\\", "_").replace("::", "__")


def _lesson_path(lesson_id: str) -> str:
    safe = _safe_lesson_id(lesson_id)
    return os.path.join(VECTOR_STORE_DIR, f"{safe}.json")


def save_lesson_vectors(lesson_id: str, chunks: List[Dict]) -> None:
    """
    Lưu danh sách chunk + embedding xuống file JSON.
    Mỗi chunk có dạng: { "index": int, "text": str, "embedding": [float, ...] }
    """
    path = _lesson_path(lesson_id)
    data = {"lesson_id": lesson_id, "chunks": chunks}
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)


def load_lesson_vectors(lesson_id: str) -> Optional[List[Dict]]:
    """
    Đọc lại tất cả chunk + embedding của 1 lesson từ file JSON.
    Nếu chưa có file -> trả về None.
    """
    path = _lesson_path(lesson_id)
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data.get("chunks") or []
    except Exception:
        return None
