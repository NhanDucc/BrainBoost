// backend/routes/lessonChatRoutes.js
const express = require("express");
const router = express.Router();
const axios = require("axios");

const { auth } = require("../middleware/auth");
const LessonChatSession = require("../models/LessonChatSession");
const { extractTextFromDocUrl } = require("../services/docTextService");

// URL của AI Agent (Python)
const AI_AGENT_URL = process.env.AI_AGENT_URL + "/lesson-chat";

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

    // lessonId duy nhất để lưu vector DB và summary
    const lessonId = `${courseId}::${lessonKey}`;

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

    // 2) Trích text từ tài liệu gốc (để gửi cho AI Agent lần đầu)
    let lessonText = "";
    if (docUrl) {
      try {
        const extractor = extractTextFromDocUrl;
        if (typeof extractor === "function") {
          const raw = await extractor(docUrl);
          if (raw && raw.trim()) {
            // Giới hạn độ dài để tránh payload quá lớn
            lessonText = raw.length > 16000 ? raw.slice(0, 16000) : raw;
          }
        }
      } catch (e) {
        console.warn(
          "[LessonChat] doc extract failed, will rely on slides only:",
          e.message || e
        );
      }
    }

    // 3) Gọi Python AI Agent (RAG)
    const agentPayload = {
      lesson_id: lessonId,
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