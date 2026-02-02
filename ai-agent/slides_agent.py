import os
import json
from typing import List, Dict, Any
from dotenv import load_dotenv

from google import genai

# ==== ENV & CLIENT SETUP ====

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise RuntimeError("GEMINI_API_KEY is not set in environment for ai-agent")

GENERATION_MODEL = os.getenv("GENERATION_MODEL")

client = genai.Client(api_key=API_KEY)


# ==== PROMPT XÂY SLIDE (THEO CHUẨN CỦA BẠN) ====

def build_slides_prompt(text: str, slide_limit: int) -> str:
    """
    Xây prompt cho Gemini để sinh JSON slides.
    Slide_limit là số slide tối đa.
    Prompt này bám y nguyên các rule bạn đã dùng ở file JS.
    """
    prompt = f"""
You are an instructional designer for high-school students.

Your job is to design an engaging slide deck that will later be rendered with attractive visual styles (colors, icons, layouts) by the frontend. In this JSON, you ONLY provide clean, well-structured TEXT that is easy to turn into beautiful slides.

From the lecture text below, create a clear slide deck with at most {slide_limit} slides.
Each slide should be short, focused, and suitable for reading on a screen.

CONTENT RULES:
- Use ONLY information that is explicitly present in the lecture text.
- Do NOT invent new facts, examples, stories, analogies, formulas, or definitions.
- You may paraphrase and simplify, but the meaning must stay faithful to the source.
- Do NOT add your own opinions or extra ideas.

Return ONLY JSON with this exact structure:

{{
  "slides": [
    {{
      "index": 1,
      "title": "Short slide title",
      "bullets": ["point 1", "point 2", "point 3"],
      "ttsText": "One short paragraph (max 300 characters) that can be read aloud for this slide."
    }}
  ]
}}

FORMAT RULES:
- "index" starts from 1 and increases by 1.
- "title" must be concise and descriptive (max 80 characters), and feel like a strong visual heading for the slide.
- "bullets" is an array of 2–5 short bullet strings (no nested lists, no numbering).
  * Each bullet should highlight a single key idea, definition, example, or step.
  * Write bullets so that they will look engaging when rendered on a slide (clear, concrete, not too long), but keep them as plain text here.
- "ttsText" MUST be plain text (no bullet marks, no markdown, no HTML, no emojis).
  * "ttsText" is a natural-sounding spoken explanation for this slide (max 300 characters).
  * It must only describe content that is actually in this slide and in the original lecture text.
- Do NOT include any other top-level fields.
- Do NOT wrap the JSON in backticks or a code block.

Lecture text:
\"\"\"{text}\"\"\"
""".strip()

    return prompt


# ==== PARSE & NORMALISE JSON TỪ MODEL ====

def _parse_slides_json(raw_text: str) -> List[Dict[str, Any]]:
    """
    Parse JSON từ model, xử lý trường hợp model lỡ bọc ```json```.
    Trả về list slides (dict).
    """
    if not raw_text:
        raise ValueError("Empty response text from model when parsing slides JSON")

    cleaned = raw_text.strip()

    # Nếu model lỡ bọc ```json ... ```, bóc ra
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    data = json.loads(cleaned)
    slides = data.get("slides") or []

    if not isinstance(slides, list):
        raise ValueError("Invalid slides JSON: 'slides' is not a list")

    return slides


def _normalise_slides(slides: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Đảm bảo mỗi slide có đúng các field:
    - index: int (1..N, gán lại nếu model không chuẩn)
    - title: str
    - bullets: list[str]
    - ttsText: str
    Không thêm field khác để phù hợp schema backend.
    """
    normalised: List[Dict[str, Any]] = []

    for i, s in enumerate(slides, start=1):
        if not isinstance(s, dict):
            continue

        title = str(s.get("title", "")).strip() or f"Slide {i}"

        bullets = s.get("bullets") or []
        if not isinstance(bullets, list):
            bullets = [bullets]
        bullets = [str(b).strip() for b in bullets if str(b).strip()]

        tts = str(s.get("ttsText", "")).strip()

        normalised.append(
            {
                "index": i,
                "title": title,
                "bullets": bullets,
                "ttsText": tts,
            }
        )

    return normalised


# ==== HÀM CHÍNH: GỌI MODEL TẠO SLIDE ====

def generate_slides_for_lesson(
    lesson_id: str,
    lesson_title: str,
    lesson_text: str,
    num_slides: int = 8,
) -> List[Dict[str, Any]]:
    """
    Gọi Gemini để tạo slide deck từ lesson_text.
    Trả về list[dict] có keys: index, title, bullets, ttsText.
    """

    text = (lesson_text or "").strip()
    if not text:
        raise ValueError("lesson_text is empty, cannot generate slides")

    slide_limit = max(1, num_slides)

    prompt = build_slides_prompt(text, slide_limit)

    # Gọi model
    resp = client.models.generate_content(
        model=GENERATION_MODEL,
        contents=prompt,
    )

    raw = (getattr(resp, "text", "") or "").strip()
    if not raw:
        raise RuntimeError("Model returned empty text for slides generation")

    try:
        slides_raw = _parse_slides_json(raw)
    except Exception as e:
        print("[SlidesAgent] Failed to parse JSON from model:", e)
        print("[SlidesAgent] Raw model output:\n", raw[:2000])
        raise

    slides = _normalise_slides(slides_raw)

    # Cắt lại theo num_slides nếu model trả nhiều hơn
    if len(slides) > slide_limit:
        slides = slides[:slide_limit]

    return slides
