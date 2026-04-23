from typing import Optional, List, Dict, Tuple
import os
import math
from dotenv import load_dotenv

from google import genai
from google.genai import types

from vector_store import save_lesson_vectors, load_lesson_vectors

# ==== ENV & CLIENT SETUP ====

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise RuntimeError("GEMINI_API_KEY is not set in environment for ai-agent")

GENERATION_MODEL = os.getenv("GENERATION_MODEL")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL")

print(f"[RAG] Using generation model: {GENERATION_MODEL}")
print(f"[RAG] Using embedding model: {EMBEDDING_MODEL}")

client = genai.Client(api_key=API_KEY)

# ========== RAG Helper Functions ==========

# Split long text into smaller chunks of about max_chars to meet token limits and improve search accuracy
def chunk_text(text: str, max_chars: int = 800) -> List[str]:
    # Return an empty list if the input text is missing
    if not text:
        return []

    # Normalize whitespace
    normalized = " ".join(text.split())
    if not normalized:
        return []

    chunks: List[str] = []
    start = 0
    n = len(normalized)
    
    # Loop through the text and slice it into chunks of `max_chars`
    while start < n:
        end = min(start + max_chars, n)
        chunks.append(normalized[start:end])
        start = end
        
    return chunks

# Generates a vector embedding for a given text chunk using the configured embedding model
def embed_text(text: str) -> list[float]:
    # Clean the input text
    text = (text or "").strip()
    if not text:
        return []

    # Call the Gemini API to generate the embedding
    resp = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text,
    )

    # Extract the embedding values from the response safely
    try:
        emb = resp.embeddings[0].values
    except Exception as e:
        print("[RAG] embed_text error:", e, "resp=", resp)
        return []

    return list(emb)

# Generates a query‑specific embedding, kept distinct from embed_text to allow future parameter adjustments
def embed_query(text: str) -> list[float]:
    # Clean the query string
    text = (text or "").strip()
    if not text:
        return []

    # Request the embedding from the model
    resp = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text,
    )

    # Safely extract the vector array
    try:
        emb = resp.embeddings[0].values
    except Exception as e:
        print("[RAG] embed_query error:", e, "resp=", resp)
        return []

    return list(emb)

# Computes cosine similarity to assess query–text closeness, ranging −1.0 to 1.0
def cosine_similarity(a: List[float], b: List[float]) -> float:
    # Validate that both vectors exist and have the same dimensions
    if not a or not b or len(a) != len(b):
        return 0.0

    dot = 0.0
    na = 0.0
    nb = 0.0
    
    # Calculate dot product and the magnitude of each vector
    for x, y in zip(a, b):
        dot += x * y
        na += x * x
        nb += y * y

    # Prevent division by zero
    if na <= 0.0 or nb <= 0.0:
        return 0.0

    # Return the cosine similarity formula result
    return dot / (math.sqrt(na) * math.sqrt(nb))

# Ingests a lesson by truncating, chunking, embedding, and storing vectors in ChromaDB
def prepare_lesson_vectors(
    lesson_id: str,
    lesson_text: str,
    max_total_chars: int = 16000,
) -> List[Dict]:

    if not lesson_text:
        return []

    # Normalize text and enforce a maximum character limit to prevent memory/cost overload
    combined = " ".join(lesson_text.split())
    if len(combined) > max_total_chars:
        combined = combined[:max_total_chars]

    # Split the lesson into manageable chunks
    chunks_text = chunk_text(combined)
    chunks: List[Dict] = []

    # Generate an embedding for each chunk
    for idx, ch in enumerate(chunks_text):
        emb = embed_text(ch)
        if not emb:
            continue
        
        # Store the chunk data along with its vector embedding
        chunks.append(
            {
                "index": idx,
                "text": ch,
                "embedding": emb,
            }
        )

    # Save the processed chunks to the persistent vector database
    if chunks:
        save_lesson_vectors(lesson_id, chunks)

    return chunks

# "Retrieves Top‑K relevant text by loading or embedding vectors, scoring query similarity, and returning the best chunks
def retrieve_relevant_context(
    lesson_id: str,
    user_message: str,
    lesson_text: str,
    top_k: int = 5,
) -> str:

    # Try to load existing vectors from the vector store
    chunks = load_lesson_vectors(lesson_id)

    # If vectors do not exist, process and ingest the lesson text
    if not chunks:
        chunks = prepare_lesson_vectors(lesson_id, lesson_text)

    if not chunks:
        # Failsafe: Nothing to retrieve
        print("[RAG] No chunks found for lesson_id:", lesson_id)
        return ""

    # Convert the user's message into a vector
    q_emb = embed_query(user_message)
    if not q_emb:
        print("[RAG] embed_query returned empty vector")
        return ""

    # Calculate similarity between the query and all lesson chunks
    scored: List[Tuple[float, str]] = []
    for ch in chunks:
        emb = ch.get("embedding") or []
        text = ch.get("text") or ""
        if not emb or not text:
            continue
            
        # Calculate how well this chunk matches the query
        sim = cosine_similarity(q_emb, emb)
        scored.append((sim, text))

    if not scored:
        return ""

    # Sort chunks by highest similarity score
    scored.sort(key=lambda x: x[0], reverse=True)
    
    # Extract the text of the top K highest-scoring chunks
    selected_texts = [t for _, t in scored[:top_k] if t]

    # Join the selected chunks with a clear separator
    return "\n\n---\n\n".join(selected_texts)


# ========== Prompt Engineering ==========

# Constructs core AI Tutor instructions, enforcing scope, tone, and RAG context rules
def build_system_prompt() -> str:
    return """
        You are "BrainBoost Lesson Tutor", a polite AI teaching assistant for secondary-school and high-school students.

        Your job:
        - Answer ONLY questions that are covered by the current lesson content.
        - The lesson content is provided below as SELECTED LESSON CONTEXT.

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

# Converts JSON chat history into a readable transcript for LLM context
def format_history(history: List[Dict]) -> str:
    if not history:
        return "(No previous conversation)"
    
    lines = []

    # Extract only the 10 most recent messages to prevent exceeding the context window limit
    recent_history = history[-10:] 
    
    # Loop through messages and format them based on the sender's role
    for msg in recent_history:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role == "user":
            lines.append(f"Student: {content}")
        else:
            lines.append(f"Tutor: {content}")
            
    return "\n".join(lines)


# ========== Main Tutor Execution Function ==========

# Main AI Tutor orchestrator: retrieves context, formats history, builds prompt, and calls Gemini
def call_lesson_tutor(
    lesson_id: str,
    lesson_text: str,
    history: List[Dict],
    user_message: str,
    lesson_title: Optional[str] = None,
) -> str:

    # Initialize the base behavior rules
    system_prompt = build_system_prompt()
    title_line = f"Lesson title: {lesson_title}\n" if lesson_title else ""

    # Execute RAG to find the exact parts of the lesson needed to answer the question
    rag_context = retrieve_relevant_context(
        lesson_id=lesson_id,
        user_message=user_message,
        lesson_text=lesson_text,
    )
    
    # Fallback if no context could be found
    if not rag_context:
        rag_context = "(No lesson context available...)"

    # Format the retrieved chunks into a clearly bounded context block
    context_block = (
        f"--- SELECTED LESSON CONTEXT START ---\n"
        f"{title_line}{rag_context}\n"
        f"--- SELECTED LESSON CONTEXT END ---"
    )

    # Convert the history array into a readable transcript
    conversation_history_text = format_history(history)

    # Assemble the final prompt by injecting system rules, context, history, and the new query
    final_prompt = f"""
        {system_prompt}

        {context_block}

        --- CONVERSATION HISTORY START ---
        {conversation_history_text}
        --- CONVERSATION HISTORY END ---

        Student's latest message:
        \"\"\"{user_message}\"\"\"

        Now write your reply to the student.
    """.strip()

    # Send the fully assembled prompt to the Gemini API
    try:
        resp = client.models.generate_content(
            model=GENERATION_MODEL,
            contents=final_prompt,
        )
        # Safely extract the generated text
        answer = (resp.text or "").strip()
    except Exception as e:
        # Handle API connection errors gracefully
        print("[Tutor] generate_content failed:", repr(e))
        answer = "I'm sorry, I'm having trouble connecting right now."

    return answer