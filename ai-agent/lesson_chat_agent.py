# ai-agent/lesson_chat_agent.py
from typing import Optional
import os
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Khởi tạo Gemini
API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise RuntimeError("GEMINI_API_KEY is not set in environment for ai-agent")

genai.configure(api_key=API_KEY)
model = genai.GenerativeModel("gemini-2.5-flash")


def build_lesson_context_from_slides(slides: list[dict]) -> str:
    """
    Ghép nội dung từ AI slides thành 1 đoạn text để làm context.
    slides: [{title, bullets, ttsText}, ...]
    """
    if not slides:
        return ""

    pieces: list[str] = []
    for idx, s in enumerate(slides):
        title = str(s.get("title", "")).strip()
        bullets = s.get("bullets") or []
        bullets = [str(b or "").strip() for b in bullets if str(b or "").strip()]
        tts = str(s.get("ttsText", "")).strip()

        parts = []
        if title:
            parts.append(f"Slide {idx+1}: {title}")
        if bullets:
            parts.append(" • ".join(bullets))
        if tts:
            parts.append(f"Narration: {tts}")

        if parts:
            pieces.append(" | ".join(parts))

    return "\n".join(pieces)


def build_system_prompt() -> str:
    """
    Prompt hệ thống – đúng các yêu cầu:
    - Chỉ dùng thông tin trong bài/slide
    - Câu hỏi ngoài phạm vi thì nói ngoài phạm vi
    - Có thể giải thích kỹ hơn khái niệm đã xuất hiện
    - Lịch sự với câu chào / yes/no
    """
    return """
You are "BrainBoost Lesson Tutor", a polite AI teaching assistant for secondary-school and high-school students.

Your job:
- Answer ONLY questions that are covered by the current lesson content.
- The lesson content is provided below in the LESSON CONTEXT (from the teacher's uploaded document and/or AI-generated slides).

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


def call_lesson_tutor(
    lesson_text: str,
    slides_text: str,
    prev_summary: str,
    user_message: str,
    lesson_title: Optional[str] = None,
) -> tuple[str, str]:
    """
    Gọi Gemini để trả lời học sinh + cập nhật summary hội thoại.
    Trả về: (answer, new_summary)
    """

    system_prompt = build_system_prompt()

    title_line = f"Lesson title: {lesson_title}\n" if lesson_title else ""

    # Ghép context bài giảng
    context_parts = []
    if slides_text:
        context_parts.append(slides_text)
    if lesson_text:
        context_parts.append(lesson_text)

    if context_parts:
        lesson_context = "\n\n".join(context_parts)
    else:
        lesson_context = "(No extracted lesson text available.)"

    lesson_block = (
        f"--- LESSON CONTEXT START ---\n{title_line}{lesson_context}\n"
        f"--- LESSON CONTEXT END ---"
    )

    summary_block = (
        f"Previous conversation summary:\n{prev_summary}"
        if prev_summary
        else "Previous conversation summary: (no previous conversation yet for this student and lesson)."
    )

    final_prompt = f"""
{system_prompt}

{lesson_block}

{summary_block}

Student's latest message:
\"\"\"{user_message}\"\"\"

Now write your reply to the student following all the rules above.
""".strip()

    # 1) Gọi model để trả lời
    resp = model.generate_content(final_prompt)
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
        sum_resp = model.generate_content(summarise_prompt)
        new_summary = (sum_resp.text or "").strip() or prev_summary
    except Exception:
        # Nếu tóm tắt lỗi thì giữ summary cũ
        new_summary = prev_summary

    return answer, new_summary
