const express = require("express");
const router = express.Router();
const axios = require("axios");
const { auth } = require("../middleware/auth");
const { extractTextFromDocUrl } = require("../services/docTextService");
const { getHistory, saveHistory } = require("../services/jsonMemoryService");

const AI_AGENT_URL = process.env.AI_AGENT_URL + "/lesson-chat";

router.post("/", auth, async (req, res) => {
  try {
    const userId = req.userId;
    const {
      courseId,
      lessonKey,
      lessonTitle,
      userMessage,
      docUrl,
      aiSlides,
    } = req.body || {};

    if (!courseId || !lessonKey) {
      return res.status(400).json({ message: "courseId and lessonKey are required." });
    }

    // Retrieve old chat history from the database.
    let history = await getHistory(userId, courseId, lessonKey);

    // Prepare lesson text
    let lessonText = "";
    if (Array.isArray(aiSlides) && aiSlides.length > 0) {
      lessonText = aiSlides.map(s => 
        `Slide ${s.index}: ${s.title}\n${(s.bullets||[]).join(". ")}\n${s.ttsText||""}`
      ).join("\n\n");
    }
    if (docUrl) {
      try {
        const raw = await extractTextFromDocUrl(docUrl);
        if (raw && raw.trim()) {
        lessonText = raw.length > 12000 ? raw.slice(0, 12000) : raw;
        }
      } catch (e) {
          console.warn("Doc extract failed", e.message);
      }
    }

    // Send to Python Agent
    const agentPayload = {
      lesson_id: `${courseId}_${lessonKey}`,
      lesson_text: lessonText, 
      history: history,
      user_message: userMessage,
      lesson_title: lessonTitle || "",
    };

    const agentResp = await axios.post(AI_AGENT_URL, agentPayload, {
      timeout: 30000,
    });

    const { answer } = agentResp.data || {};
    if (!answer) {
      return res.status(500).json({ message: "AI Agent did not return an answer." });
    }

    // Update history: Add new questions and answers.
    history.push({ role: "user", content: userMessage });
    history.push({ role: "model", content: answer });
    
    await saveHistory(userId, courseId, lessonKey, history);

    return res.json({ answer });

  } catch (err) {
    console.error("[LessonChat] Error:", err.message);
    return res.status(500).json({ message: "Chat failed", error: err.message });
  }
});

module.exports = router;