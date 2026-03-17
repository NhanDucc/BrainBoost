const express = require("express");
const router = express.Router();
const axios = require("axios");
const { auth } = require("../middleware/auth");
const { extractTextFromDocUrl } = require("../services/docTextService");

// Retrieve the AI microservice URL from environment variables
const AI_AGENT_URL = process.env.AI_AGENT_URL;

/**
 * * POST /api/learning/flashcards/generate
 * Purpose: Extracts text from the current lesson (AI Slides or Original Document) 
 * and delegates the flashcard generation task to the Python AI microservice.
 * Access: Requires user authentication (enforced by the 'auth' middleware).
 */
router.post("/generate", auth, async (req, res) => {
    try {
        // Destructure the document URL and AI slides array from the incoming request body
        const { docUrl, aiSlides } = req.body || {};

        // Ensure the backend is properly configured to talk to the AI agent
        if (!AI_AGENT_URL) {
            return res.status(500).json({ message: "AI_AGENT_URL is not configured in .env" });
        }

        // Gather text from available lesson materials
        let lessonText = "";
        
        // Prioritize AI Slides if they exist, as they are already summarized
        if (Array.isArray(aiSlides) && aiSlides.length > 0) {
            lessonText = aiSlides.map(s => 
                `Slide ${s.index || ''}: ${s.title || ''}\n${(s.bullets||[]).join(". ")}\n${s.ttsText||""}`
            ).join("\n\n");
        } 
        // Fallback: Extract raw text directly from the original uploaded document
        else if (docUrl) {
            try {
                const raw = await extractTextFromDocUrl(docUrl);
                if (raw && raw.trim()) {
                    // Cap the text at ~15,000 characters to prevent overloading the AI model context window
                    lessonText = raw.length > 15000 ? raw.slice(0, 15000) : raw; 
                }
            } catch (e) {
                // Log extraction failures without immediately crashing the route
                console.warn("[Flashcards] Document extraction failed:", e.message);
            }
        }

        // Abort the operation if no readable text was found in either slides or document
        if (!lessonText.trim()) {
            return res.status(400).json({ message: "Could not find any readable text in this lesson to generate flashcards." });
        }

        // Prepare payload for the Python AI Agent
        const agentPayload = {
            lesson_text: lessonText,
            // Request the AI to generate exactly 15 flashcards
            num_cards: 15 
        };

        // Call the Python AI Microservice
        const agentResp = await axios.post(`${AI_AGENT_URL}/generate-flashcards`, agentPayload, {
            // Allow up to 45 seconds for the AI to process and generate content
            timeout: 45000,
        });

        // Safely extract the flashcards array from the Python service's JSON response
        const flashcards = agentResp.data?.flashcards || [];

        if (!flashcards.length) {
            return res.status(500).json({ message: "The AI failed to generate flashcards from this content." });
        }

        // Return the successfully generated flashcard deck to the React client
        return res.json({ flashcards });

    } catch (err) {
        console.error("[Flashcards] AI Agent Error:", err.message);
        return res.status(500).json({ 
            message: "Server error while generating flashcards.", 
            error: err.message 
        });
    }
});

module.exports = router;