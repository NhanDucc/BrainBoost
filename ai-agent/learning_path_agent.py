import os
import json
from google import genai
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")
GENERATION_MODEL = os.getenv("GENERATION_MODEL")

client = genai.Client(api_key=API_KEY)

def generate_path(user_goal: str, courses: list) -> dict:
    # Chuyển danh sách khóa học thành chuỗi rút gọn để tiết kiệm token
    courses_str = "\n".join([
        f"- ID: {c.get('id')}, Title: {c.get('title')}, Subject: {c.get('subject')}, Grade: {c.get('grade')}, Desc: {c.get('description')[:100]}..."
        for c in courses
    ])

    prompt = f"""
    You are an expert Academic Advisor at BrainBoost.
    
    User Goal: "{user_goal}"

    Available Courses in Database:
    {courses_str}

    Task:
    1. Analyze the user's goal.
    2. Select the most relevant courses from the "Available Courses" list to form a learning path.
    3. Order them logically (e.g., Foundation -> Advanced).
    4. Provide a short reason why each course fits the goal.

    Output format: JSON ONLY.
    {{
        "advice": "A short encouraging paragraph addressing the student directly.",
        "recommended_courses": [
            {{
                "course_id": "ID_FROM_LIST_ABOVE",
                "reason": "Why this course is needed."
            }}
        ]
    }}
    """

    try:
        resp = client.models.generate_content(
            model=GENERATION_MODEL,
            contents=prompt,
            config={'response_mime_type': 'application/json'} # Ép trả về JSON chuẩn
        )
        return json.loads(resp.text)
    except Exception as e:
        print("Learning Path Error:", e)
        return {"advice": "Sorry, I couldn't generate a path right now.", "recommended_courses": []}