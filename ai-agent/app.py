from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional

from lesson_chat_agent import call_lesson_tutor
from slides_agent import generate_slides_for_lesson

app = FastAPI(title="BrainBoost AI Agent")

# ==== Create slide based on lesson content ====
class SlidesRequest(BaseModel):
    lesson_id: str
    lesson_title: str
    lesson_text: str
    num_slides: int = 8

class SlidesResponse(BaseModel):
    slides: list[dict]


# ==== Lesson chat model ====
class LessonChatRequest(BaseModel):
    lesson_id: str
    lesson_text: Optional[str] = ""
    history: list[dict] = []          # List các object {role, content}
    user_message: str
    lesson_title: Optional[str] = None

class LessonChatResponse(BaseModel):
    answer: str

# ==== Create learning path model ====
class LearningPathRequest(BaseModel):
    user_goal: str
    available_courses: list[dict] # Danh sách gồm {id, title, subject, grade, description}

class LearningPathResponse(BaseModel):
    advice: str # Lời khuyên chung
    recommended_courses: list[dict] # Danh sách course_id và lý do recommend


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

@app.post("/lesson-chat", response_model=LessonChatResponse)
def lesson_chat(req: LessonChatRequest):
    # Gọi hàm xử lý mới, truyền history thay vì summary
    answer = call_lesson_tutor(
        lesson_id=req.lesson_id,
        lesson_text=req.lesson_text or "",
        history=req.history,       # <-- Truyền list
        user_message=req.user_message,
        lesson_title=req.lesson_title,
    )

    return LessonChatResponse(answer=answer)

@app.post("/generate-learning-path", response_model=LearningPathResponse)
def generate_learning_path_api(req: LearningPathRequest):
    """
    Tạo lộ trình học dựa trên mục tiêu người dùng và danh sách khóa học
    """
    from learning_path_agent import generate_path # Chúng ta sẽ tạo file này sau
    return generate_path(req.user_goal, req.available_courses)