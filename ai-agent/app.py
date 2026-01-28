from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional

from lesson_chat_agent import call_lesson_tutor

app = FastAPI(title="BrainBoost AI Agent")

# Pydantic models for request and response validation
class LessonChatRequest(BaseModel):
    lesson_id: str
    lesson_text: Optional[str] = ""
    prev_summary: Optional[str] = ""
    user_message: str
    lesson_title: Optional[str] = None

# Response model
class LessonChatResponse(BaseModel):
    answer: str
    new_summary: str

# Endpoint for lesson chat
@app.post("/lesson-chat", response_model=LessonChatResponse)

# Handle POST requests to /lesson-chat
def lesson_chat(req: LessonChatRequest):
    answer, new_summary = call_lesson_tutor(
        lesson_id=req.lesson_id,
        lesson_text=req.lesson_text or "",
        prev_summary=req.prev_summary or "",
        user_message=req.user_message,
        lesson_title=req.lesson_title,
    )

    # Return structured response matching `LessonChatResponse` model.
    return LessonChatResponse(answer=answer, new_summary=new_summary)