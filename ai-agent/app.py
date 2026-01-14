# ai-agent/app.py
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional

from lesson_chat_agent import (
    call_lesson_tutor,
)

app = FastAPI(title="BrainBoost AI Agent")


class LessonChatRequest(BaseModel):
    # ID duy nhất cho lesson (ví dụ: courseId:lessonKey) – backend Node gửi sang
    lesson_id: str
    # Text đã trích từ file gốc (Node backend gửi sang)
    lesson_text: Optional[str] = ""
    # Summary trước đó của hội thoại
    prev_summary: Optional[str] = ""
    # Câu hỏi mới của học sinh
    user_message: str
    # Tiêu đề bài học (optional)
    lesson_title: Optional[str] = None


class LessonChatResponse(BaseModel):
    answer: str
    new_summary: str


@app.post("/lesson-chat", response_model=LessonChatResponse)
def lesson_chat(req: LessonChatRequest):
    answer, new_summary = call_lesson_tutor(
        lesson_id=req.lesson_id,
        lesson_text=req.lesson_text or "",
        prev_summary=req.prev_summary or "",
        user_message=req.user_message,
        lesson_title=req.lesson_title,
    )

    return LessonChatResponse(answer=answer, new_summary=new_summary)
