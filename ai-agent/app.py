from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional

from lesson_chat_agent import call_lesson_tutor
from slides_agent import generate_slides_for_lesson

app = FastAPI(title="BrainBoost AI Agent")

class SlidesRequest(BaseModel):
    lesson_id: str
    lesson_title: str
    lesson_text: str
    num_slides: int = 8

class SlidesResponse(BaseModel):
    slides: list[dict]

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

@app.post("/generate-slides", response_model=SlidesResponse)
def generate_slides(req: SlidesRequest):
    """
    Gọi slides_agent để tạo slide cho 1 bài học.
    Được backend NodeJS gọi qua HTTP.
    """
    slides = generate_slides_for_lesson(
        lesson_id=req.lesson_id,
        lesson_title=req.lesson_title,
        lesson_text=req.lesson_text,
        num_slides=req.num_slides,
    )
    return {"slides": slides}

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