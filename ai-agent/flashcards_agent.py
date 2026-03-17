import os
import json
from typing import List, Dict
from dotenv import load_dotenv
from google import genai

# ==== Env & Client Setup ====

# Load environment variables from the .env file (e.g., API keys, model names)
load_dotenv()

# Retrieve the Gemini API key from the environment
API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    # Fail fast if the API key is missing to prevent silent runtime errors
    raise RuntimeError("GEMINI_API_KEY is not set in environment for ai-agent")

GENERATION_MODEL = os.getenv("GENERATION_MODEL")

# Initialize the official Google GenAI client
client = genai.Client(api_key=API_KEY)

# ==== Prompt Builder ====

# Using an f-string to dynamically inject the requested number of cards and the lecture text.
# The prompt applies strict constraints (character limits, no hallucination) 
# to ensure high-quality educational flashcards.
def build_flashcards_prompt(text: str, num_cards: int) -> str:
    prompt = f"""
        You are an expert educational AI tutor.
        Your task is to extract the most important concepts, terms, formulas, or key questions from the following lecture text.
        Generate exactly {num_cards} flashcards to help a student study for an exam using Active Recall and Spaced Repetition.

        RULES:
        - Each flashcard must have a "front" (the question, term, or concept - max 100 characters).
        - Each flashcard must have a "back" (the concise answer or definition - max 250 characters).
        - Use ONLY information explicitly found in the text. Do not invent new facts.
        - Return ONLY valid JSON with no markdown formatting or backticks.

        Expected JSON format:
        {{
        "flashcards": [
            {{
            "front": "What is the mitochondria?",
            "back": "The powerhouse of the cell, responsible for generating most of the cell's supply of ATP."
            }}
        ]
        }}

        Lecture text:
        \"\"\"{text}\"\"\"
            """
    return prompt.strip()

# ==== Parser & Normalizer ====

"""
Safely parses the JSON response from the model.
Handles edge cases where the model wraps the response in markdown code blocks (e.g. ```json).
"""
def _parse_flashcards_json(raw_text: str) -> List[Dict[str, str]]:
    if not raw_text:
        raise ValueError("Empty response text from model when parsing flashcards JSON")

    cleaned = raw_text.strip()

    # LLMs often wrap JSON outputs in Markdown code blocks.
    # We must strip these backticks out before passing the string to json.loads() to prevent parsing crashes.
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines[0].startswith("```"):
            # Remove the opening ```json
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            # Remove the closing ```
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    # Parse the cleaned string into a Python dictionary
    data = json.loads(cleaned)
    
    # Extract the 'flashcards' array, defaulting to an empty list if missing
    flashcards = data.get("flashcards") or []

    # Validate that the extracted data is indeed a list
    if not isinstance(flashcards, list):
        raise ValueError("Invalid flashcards JSON: 'flashcards' is not a list")

    return flashcards

# ==== Main Generation Function ====

"""
Calls the Gemini API to generate a deck of flashcards from the provided lesson text.
Returns a list of dictionaries with 'front' and 'back' keys.
"""
def generate_flashcards_for_lesson(
    lesson_text: str,
    num_cards: int = 15,
) -> List[Dict[str, str]]:

    text = (lesson_text or "").strip()
    
    # Validate input: Ensure there is actual text to process
    if not text:
        raise ValueError("lesson_text is empty, cannot generate flashcards")

    # Ensure the requested number of cards is at least 1
    card_limit = max(1, num_cards)
    
    # Generate the strict instruction prompt
    prompt = build_flashcards_prompt(text, card_limit)

    # Call the Gemini model via the SDK
    resp = client.models.generate_content(
        model=GENERATION_MODEL,
        contents=prompt,
    )

    # Extract the text payload from the response object
    raw = (getattr(resp, "text", "") or "").strip()
    if not raw:
        raise RuntimeError("Model returned empty text for flashcards generation")

    # Parse the response into a Python List
    try:
        flashcards = _parse_flashcards_json(raw)
    except Exception as e:
        # Log the error and the raw output to help debug hallucinated or malformed JSON
        print("[FlashcardsAgent] Failed to parse JSON from model:", e)
        print("[FlashcardsAgent] Raw model output:\n", raw[:2000])
        raise

    # Trim the array if the model returns more cards than requested
    if len(flashcards) > card_limit:
        flashcards = flashcards[:card_limit]

    return flashcards