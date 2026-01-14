# ai-agent/lesson_chat_agent.py
from typing import Optional, List, Dict, Tuple
import os
import math

import google.generativeai as genai
from dotenv import load_dotenv

from vector_store import save_lesson_vectors, load_lesson_vectors

# Load env
load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise RuntimeError("GEMINI_API_KEY is not set in environment for ai-agent")

genai.configure(api_key=API_KEY)

# Model sinh văn bản
LLM_MODEL = genai.GenerativeModel("gemini-2.5-flash")
# Model embedding dùng chung cho doc + query
EMBED_MODEL = "models/text-embedding-004"


# ========== Helper cho RAG ==========

def chunk_text(text: str, max_chars: int = 800) -> List[str]:
    """
    Cắt text dài thành nhiều chunk ~max_chars để embed.
    Chia theo độ dài, đã normalize whitespace.
    """
    if not text:
        return []

    normalized = " ".join(text.split())
    if not normalized:
        return []

    chunks: List[str] = []
    start = 0
    n = len(normalized)
    while start < n:
        end = min(start + max_chars, n)
        chunks.append(normalized[start:end])
        start = end
    return chunks


def _extract_embedding(resp) -> List[float]:
    """
    Trích embedding từ response của genai.embed_content
    (hỗ trợ cả dict lẫn object).
    """
    emb = None

    # Trường hợp phổ biến: resp là dict
    if isinstance(resp, dict):
        # {"embedding": [...]} hoặc {"embedding": {"values": [...]} }
        emb = resp.get("embedding")
        if isinstance(emb, dict):
            emb = emb.get("values")
    else:
        # Trường hợp resp là object có thuộc tính .embedding
        emb = getattr(resp, "embedding", None)
        # Một số version dùng .embedding.values
        if hasattr(emb, "values"):
            emb = emb.values

    if not emb:
        raise RuntimeError("Embedding API did not return 'embedding' values")

    return list(emb)


def embed_text(text: str) -> List[float]:
    """
    Gọi Gemini embedding cho tài liệu (document chunk).
    """
    text = (text or "").strip()
    if not text:
        return []

    resp = genai.embed_content(
        model=EMBED_MODEL,
        content=text,
        task_type="retrieval_document",
    )
    return _extract_embedding(resp)


def embed_query(text: str) -> List[float]:
    """
    Gọi Gemini embedding cho câu hỏi (query).
    """
    text = (text or "").strip()
    if not text:
        return []

    resp = genai.embed_content(
        model=EMBED_MODEL,
        content=text,
        task_type="retrieval_query",
    )
    return _extract_embedding(resp)


def cosine_similarity(a: List[float], b: List[float]) -> float:
    """
    Tính cosine similarity giữa 2 vector.
    """
    if not a or not b or len(a) != len(b):
        return 0.0

    dot = 0.0
    na = 0.0
    nb = 0.0
    for x, y in zip(a, b):
        dot += x * y
        na += x * x
        nb += y * y

    if na <= 0.0 or nb <= 0.0:
        return 0.0

    return dot / (math.sqrt(na) * math.sqrt(nb))


def prepare_lesson_vectors(
    lesson_id: str,
    lesson_text: str,
    max_total_chars: int = 16000,
) -> List[Dict]:
    """
    Ingest 1 bài học:
    - CHỈ dùng text trích từ TÀI LIỆU GỐC do giáo viên upload
    - Chunk -> embedding -> lưu xuống vector_store

    Trả về danh sách chunk đã embed.
    """
    if not lesson_text:
        # Không có file gốc thì không ingest gì cả
        return []

    # Normalize whitespace
    normalized = " ".join(lesson_text.split())
    if not normalized:
        return []

    # Giới hạn tổng chiều dài
    if len(normalized) > max_total_chars:
        normalized = normalized[:max_total_chars]

    # Cắt thành nhiều chunk
    chunks_text = chunk_text(normalized)

    chunks: List[Dict] = []
    for idx, ch in enumerate(chunks_text):
        emb = embed_text(ch)
        if not emb:
            continue
        chunks.append(
            {
                "index": idx,
                "text": ch,
                "embedding": emb,
            }
        )

    if chunks:
        save_lesson_vectors(lesson_id, chunks)

    return chunks


def retrieve_relevant_context(
    lesson_id: str,
    user_message: str,
    lesson_text: str,
    top_k: int = 5,
) -> str:
    """
    Lấy top-k đoạn text liên quan nhất tới câu hỏi:
    1. Thử load vectors từ vector_store.
    2. Nếu chưa có -> ingest từ lesson_text rồi lưu.
    3. Embed query + tính similarity -> chọn top_k -> ghép thành context.
    """
    # 1) Thử load từ vector store
    chunks = load_lesson_vectors(lesson_id)

    # 2) Nếu chưa có vector -> ingest mới
    if not chunks:
        chunks = prepare_lesson_vectors(lesson_id, lesson_text)

    if not chunks:
        # Không có gì để retrieve
        return ""

    # 3) Embed câu hỏi
    q_emb = embed_query(user_message)
    if not q_emb:
        return ""

    scored: List[Tuple[float, str]] = []
    for ch in chunks:
        emb = ch.get("embedding") or []
        text = ch.get("text") or ""
        if not emb or not text:
            continue
        sim = cosine_similarity(q_emb, emb)
        scored.append((sim, text))

    if not scored:
        return ""

    scored.sort(key=lambda x: x[0], reverse=True)
    selected_texts = [t for _, t in scored[:top_k] if t]

    return "\n\n---\n\n".join(selected_texts)


# ========== System prompt ==========

def build_system_prompt() -> str:
    """
    Prompt hệ thống – đúng các yêu cầu:
    - Chỉ dùng thông tin trong bài (từ RAG context)
    - Câu hỏi ngoài phạm vi thì nói ngoài phạm vi
    - Có thể giải thích kỹ hơn khái niệm đã xuất hiện
    - Lịch sự với câu chào / yes/no
    """
    return """
You are "BrainBoost Lesson Tutor", a polite AI teaching assistant for secondary-school and high-school students.

Your job:
- Answer ONLY questions that are covered by the current lesson content.
- The lesson content is provided below as SELECTED LESSON CONTEXT.

Scope rules:
- Use ONLY information that appears in the lesson context.
- If the student's question cannot be answered using this lesson content, politely say that the question is outside the scope of the lesson and invite them to ask something related to the lesson instead.

Using general knowledge:
- If a concept DOES appear in the lesson but is not fully explained, you may use your general knowledge to give a clearer definition or simple examples.
- Do NOT introduce advanced or unrelated topics that are not connected to the lesson.

Style:
- Always respond with a polite and encouraging tone.
- If the student greets you or just says short phrases like "hi", "hello", "yes", "no", "OK", "I agree", etc., reply briefly and kindly, then continue the explanation if relevant.
- Keep answers concise but helpful.

Level:
- Explanations must be suitable for teenagers (around 13–18 years old).
- Use short paragraphs, simple sentences, and easy-to-understand examples.

Conversation memory:
- A short summary of the previous conversation for this student and this lesson is provided.
- Use it to avoid repeating long explanations; briefly recap if needed and then continue from there.

Language:
- Reply in the same language as the student's message (English or Vietnamese), with a respectful and supportive tone.
""".strip()


# ========== Hàm chính gọi tutor ==========

def call_lesson_tutor(
    lesson_id: str,
    lesson_text: str,
    prev_summary: str,
    user_message: str,
    lesson_title: Optional[str] = None,
) -> tuple[str, str]:
    """
    Gọi Gemini để trả lời học sinh + cập nhật summary hội thoại.
    RAG chỉ dựa trên lesson_text (file gốc giáo viên upload).
    Trả về: (answer, new_summary)
    """

    system_prompt = build_system_prompt()

    title_line = f"Lesson title: {lesson_title}\n" if lesson_title else ""

    # RAG: lấy context từ vector store (hoặc ingest mới nếu chưa có)
    rag_context = retrieve_relevant_context(
        lesson_id=lesson_id,
        user_message=user_message,
        lesson_text=lesson_text,
    )

    if not rag_context:
        rag_context = "(No lesson context available from the original document. Answer briefly and politely explain that the material was not found.)"

    context_block = (
        f"--- SELECTED LESSON CONTEXT START ---\n"
        f"{title_line}{rag_context}\n"
        f"--- SELECTED LESSON CONTEXT END ---"
    )

    summary_block = (
        f"Previous conversation summary:\n{prev_summary}"
        if prev_summary
        else "Previous conversation summary: (no previous conversation yet for this student and lesson)."
    )

    final_prompt = f"""
{system_prompt}

{context_block}

{summary_block}

Student's latest message:
\"\"\"{user_message}\"\"\"


Now write your reply to the student following all the rules above.
""".strip()

    # 1) Gọi model để trả lời
    resp = LLM_MODEL.generate_content(final_prompt)
    answer = (resp.text or "").strip()
    if not answer:
        raise RuntimeError("Model returned empty answer")

    # 2) Prompt tóm tắt hội thoại
    summarise_prompt = f"""
You are an assistant that keeps a short running summary of a tutoring conversation between a student and an AI tutor.

Update the summary so that it reflects all important points discussed so far.

Constraints:
- Max 600 characters.
- Focus on what the student has asked, what the tutor has explained, key concepts, and any misunderstandings corrected.
- Ignore greetings or small talk.
- The summary must be self-contained and understandable even without the original messages.

Previous summary (may be empty):
\"\"\"{prev_summary or ""}\"\"\"


New student message:
\"\"\"{user_message}\"\"\"


New assistant reply:
\"\"\"{answer}\"\"\"


Return ONLY the updated summary as plain text.
""".strip()

    try:
        sum_resp = LLM_MODEL.generate_content(summarise_prompt)
        new_summary = (sum_resp.text or "").strip() or prev_summary
    except Exception:
        new_summary = prev_summary

    return answer, new_summary
