const express = require("express");
const router = express.Router();
const axios = require("axios");
const { auth } = require("../middleware/auth");
const { extractTextFromDocUrl } = require("../services/docTextService");

// Import service mới
const { getHistory, saveHistory, cleanupOldMemories } = require("../services/jsonMemoryService");

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

    // 1) Lấy lịch sử chat cũ từ file JSON
    let history = await getHistory(userId, courseId, lessonKey);

    // 2) Chuẩn bị lesson text (giữ nguyên logic cũ)
    let lessonText = "";
    if (Array.isArray(aiSlides) && aiSlides.length > 0) {
      lessonText = aiSlides.map(s => 
        `Slide ${s.index}: ${s.title}\n${(s.bullets||[]).join(". ")}\n${s.ttsText||""}`
      ).join("\n\n");
    }
    if (docUrl) {
      try {
         // Logic extract cũ giữ nguyên...
         // (Đoạn này code cũ của bạn extractDocUrl, mình lược bớt cho gọn)
      } catch (e) {
          console.warn("Doc extract failed", e.message);
      }
    }

    // 3) Gửi sang Python Agent: Thay vì prev_summary, giờ gửi HISTORY
    const agentPayload = {
      lesson_id: `${courseId}_${lessonKey}`, // ID định danh để Python RAG vector
      lesson_text: lessonText, 
      history: history, // <--- TRUYỀN FULL LIST JSON
      user_message: userMessage,
      lesson_title: lessonTitle || "",
    };

    const agentResp = await axios.post(AI_AGENT_URL, agentPayload, {
      timeout: 30000, // Tăng timeout chút vì xử lý context dài hơn
    });

    const { answer } = agentResp.data || {};
    if (!answer) {
      return res.status(500).json({ message: "AI Agent did not return an answer." });
    }

    // 4) Cập nhật file JSON: Thêm câu hỏi mới và câu trả lời mới
    history.push({ role: "user", content: userMessage });
    history.push({ role: "model", content: answer });
    
    await saveHistory(userId, courseId, lessonKey, history);

    // 5) Trigger cleanup (chạy ngầm, không await để không block user)
    cleanupOldMemories();

    return res.json({ answer });

  } catch (err) {
    console.error("[LessonChat] Error:", err.message);
    return res.status(500).json({ message: "Chat failed", error: err.message });
  }
});

module.exports = router;