from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional

from lesson_chat_agent import call_lesson_tutor
from slides_agent import generate_slides_for_lesson
from learning_path_agent import generate_path
from grading_agent import grade_essay_logic
from flashcards_agent import generate_flashcards_for_lesson

# Initialize the FastAPI application
app = FastAPI(title="BrainBoost AI Agent")

# ==== Pydantic Models (Data Validation Schemas) ====

# ---- Slide Generation Models ----
class SlidesRequest(BaseModel):
    lesson_id: str
    lesson_title: str
    lesson_text: str
    num_slides: int = 8
class SlidesResponse(BaseModel):
    slides: list[dict]

# ---- Contextual Lesson Chat Models ----
class LessonChatRequest(BaseModel):
    lesson_id: str
    lesson_text: Optional[str] = ""
    # Represents the conversation memory; list of objects like: {"role": "user"|"ai", "content": "..."}
    history: list[dict] = []
    user_message: str
    lesson_title: Optional[str] = None
class LessonChatResponse(BaseModel):
    answer: str

# ---- Learning Path Generation Models ----
class LearningPathRequest(BaseModel):
    user_goal: str
    # List of available courses formatted as: {id, title, subject, grade, description}
    available_courses: list[dict]
class LearningPathResponse(BaseModel):
    # General guidance or study strategy provided by the AI
    advice: str
    # List containing course_ids and the AI's reasoning for recommending them
    recommended_courses: list[dict]

# ---- Essay Auto-Grading Models ----
class GradeEssayRequest(BaseModel):
    question: str
    student_answer: str
    # Optional rubric or exact answer for the AI to compare against
    model_answer: Optional[str] = ""
class GradeEssayResponse(BaseModel):
    score: float
    feedback: str
    suggestion: str

# ---- Auto-Flashcards Models ----
class FlashcardRequest(BaseModel):
    lesson_text: str
    # Default to requesting 15 flashcards if not specified by the client
    num_cards: int = 15

# ==== API Endpoints ====

"""
Triggers the slides_agent to synthesize a presentation deck from raw lesson text.
Typically called by the Node.js backend when an instructor creates a new lesson.
"""
@app.post("/generate-slides", response_model=SlidesResponse)
def generate_slides(req: SlidesRequest):
    slides = generate_slides_for_lesson(
        lesson_id=req.lesson_id,
        lesson_title=req.lesson_title,
        lesson_text=req.lesson_text,
        num_slides=req.num_slides,
    )
    return {"slides": slides}

"""
Handles queries directed at the AI Tutor during a specific lesson.
Injects the lesson text and previous chat history into the LLM prompt 
so the AI can provide highly contextual and accurate answers.
"""
@app.post("/lesson-chat", response_model=LessonChatResponse)
def lesson_chat(req: LessonChatRequest):
    answer = call_lesson_tutor(
        lesson_id=req.lesson_id,
        lesson_text=req.lesson_text or "",
        # Pass the full conversation thread for memory retention
        history=req.history,
        user_message=req.user_message,
        lesson_title=req.lesson_title,
    )

    return LessonChatResponse(answer=answer)

"""
Evaluates a user's stated learning goals against the catalog of available courses.
Returns a personalized curriculum/pathway with justifications.
"""
@app.post("/generate-learning-path", response_model=LearningPathResponse)
def generate_learning_path_api(req: LearningPathRequest):
    return generate_path(req.user_goal, req.available_courses)

"""
Evaluates a student's essay or short answer.
Compares the student's submission against the question and the instructor's model answer (rubric),
returning a quantitative score alongside qualitative feedback.
"""
@app.post("/grade-essay", response_model=GradeEssayResponse)
def grade_essay_endpoint(req: GradeEssayRequest):
    result = grade_essay_logic(req.question, req.student_answer, req.model_answer)
    # Unpack the resulting dictionary directly into the Pydantic response model
    return GradeEssayResponse(**result)

"""
Reads the lesson material and extracts key terms/concepts into a deck of flashcards.
Wrapped in a try-except block to gracefully handle potential JSON parsing errors from the LLM.
"""
@app.post("/generate-flashcards")
def api_generate_flashcards(req: FlashcardRequest):
    try:
        cards = generate_flashcards_for_lesson(req.lesson_text, req.num_cards)
        return {"flashcards": cards}
    except Exception as e:
        return {"error": str(e)}