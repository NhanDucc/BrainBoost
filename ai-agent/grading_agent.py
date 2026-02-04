import os
import json
from google import genai
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")
GENERATION_MODEL = os.getenv("GENERATION_MODEL")

client = genai.Client(api_key=API_KEY)

def grade_essay_logic(question: str, student_answer: str, model_answer: str = "") -> dict:
    prompt = f"""
    You are an expert AI Teacher. Grade the following student essay based on the question and the model answer (rubric).
    
    ---
    Question: "{question}"
    
    Model Answer / Rubric (Use this as the ground truth): 
    "{model_answer if model_answer else 'No specific rubric provided. Grade based on general academic accuracy for this topic.'}"
    
    Student's Answer:
    "{student_answer}"
    ---
    
    Task:
    1. Evaluate the student's accuracy, clarity, and completeness.
    2. Give a score from 0 to 10.
    3. Provide constructive feedback (what is good, what is missing).
    4. Suggest a corrected or improved version if necessary.

    Output JSON format ONLY:
    {{
        "score": 8.5,
        "feedback": "Good understanding of the core concept...",
        "suggestion": "You should mention..."
    }}
    """

    try:
        resp = client.models.generate_content(
            model=GENERATION_MODEL,
            contents=prompt,
            config={'response_mime_type': 'application/json'}
        )
        return json.loads(resp.text)
    except Exception as e:
        print(f"Grading Error: {e}")
        return {"score": 0, "feedback": "AI Error: Could not grade this essay.", "suggestion": ""}