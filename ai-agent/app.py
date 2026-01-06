# ai-agent/app.py
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional, List, Dict

from lesson_chat_agent import (
    call_lesson_tutor,
    build_lesson_context_from_slides,
)

app = FastAPI(title="BrainBoost AI Agent")


class LessonChatRequest(BaseModel):
    # text đã trích từ file gốc (Node backend gửi sang)
    lesson_text: Optional[str] = ""
    # slides AI (Node gửi sang)
    ai_slides: Optional[List[Dict]] = None
    # summary trước đó của hội thoại
    prev_summary: Optional[str] = ""
    # câu hỏi mới của học sinh
    user_message: str
    # tiêu đề bài học (optional)
    lesson_title: Optional[str] = None


class LessonChatResponse(BaseModel):
    answer: str
    new_summary: str


@app.post("/lesson-chat", response_model=LessonChatResponse)
def lesson_chat(req: LessonChatRequest):
    slides_text = ""
    if req.ai_slides:
        slides_text = build_lesson_context_from_slides(req.ai_slides)

    answer, new_summary = call_lesson_tutor(
        lesson_text=req.lesson_text or "",
        slides_text=slides_text,
        prev_summary=req.prev_summary or "",
        user_message=req.user_message,
        lesson_title=req.lesson_title,
    )

    return LessonChatResponse(answer=answer, new_summary=new_summary)
