// backend/routes/lessonChatRoutes.js
const express = require("express");
const router = express.Router();
const axios = require("axios");

const { auth } = require("../middleware/auth");
const LessonChatSession = require("../models/LessonChatSession");
const {
  extractTextFromDocUrl,
  extractTextFromRemoteFile,
} = require("../services/docTextService");

// URL của AI Agent (Python)
const AI_AGENT_URL =
  process.env.AI_AGENT_URL || "http://localhost:8001/lesson-chat";

/**
 * POST /api/lesson-chat
 * Body:
 *  {
 *    courseId, lessonKey, lessonTitle?,
 *    userMessage,
 *    docUrl?,        // URL tài liệu gốc nếu có
 *    aiSlides? []    // slides AI nếu có
 *  }
 */
router.post("/", auth, async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated." });
    }

    const {
      courseId,
      lessonKey,
      lessonTitle,
      userMessage,
      docUrl,
      aiSlides,
    } = req.body || {};

    if (!courseId || !lessonKey) {
      return res
        .status(400)
        .json({ message: "courseId and lessonKey are required." });
    }

    if (!userMessage || !userMessage.trim()) {
      return res.status(400).json({ message: "Message is empty." });
    }

    // 1) Lấy / tạo session tóm tắt hội thoại
    let session = await LessonChatSession.findOne({
      userId,
      courseId,
      lessonKey,
    });

    if (!session) {
      session = await LessonChatSession.create({
        userId,
        courseId,
        lessonKey,
        lessonTitle: lessonTitle || "",
        summary: "",
      });
    }

    const prevSummary = session.summary || "";

    // 2) Trích text từ tài liệu gốc (để gửi cho AI Agent)
    let lessonText = "";
    if (docUrl) {
    try {
        const raw = await extractTextFromDocUrl(docUrl);
        if (raw && raw.trim()) {
        lessonText = raw.length > 12000 ? raw.slice(0, 12000) : raw;
        }
    } catch (e) {
        console.error("[LessonChat] error:", e.message || e);
        return res.status(500).json({
        message: "Failed to talk to the lesson tutor",
        error: e.message,
        });
    }
    }

    // 3) Gọi Python AI Agent
    const agentPayload = {
      lesson_text: lessonText,
      ai_slides: Array.isArray(aiSlides) ? aiSlides : [],
      prev_summary: prevSummary,
      user_message: userMessage,
      lesson_title: lessonTitle || "",
    };

    const agentResp = await axios.post(AI_AGENT_URL, agentPayload, {
      timeout: 20000,
    });

    const { answer, new_summary } = agentResp.data || {};
    if (!answer) {
      return res.status(500).json({
        message: "AI Agent did not return an answer.",
      });
    }

    // 4) Lưu summary mới
    if (new_summary) {
      session.summary = new_summary;
    }
    if (!session.lessonTitle && lessonTitle) {
      session.lessonTitle = lessonTitle;
    }
    await session.save();

    return res.json({ answer });
  } catch (err) {
    console.error("[LessonChat] error:", err.message || err);
    return res.status(500).json({
      message: "Failed to talk to the lesson tutor.",
      error: err.message,
    });
  }
});

module.exports = router;
