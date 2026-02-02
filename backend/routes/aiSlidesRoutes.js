const express = require("express");
const router = express.Router();
const { auth, authorize } = require("../middleware/auth");
const axios = require("axios");
const { extractTextFromDocUrl } = require("../services/docTextService");

const AI_AGENT_URL = process.env.AI_AGENT_URL;

// POST /api/ai-slides/generate
// Dùng khi đang ở màn "Create course" (chưa có courseId trong Mongo)
// Frontend gửi: { docUrl, maxSlides }
router.post(
  "/generate",
  auth,
  authorize("admin", "instructor"),
  async (req, res) => {
    try {
      const { docUrl, maxSlides } = req.body || {};

      if (!docUrl) {
        return res.status(400).json({ message: "docUrl is required" });
      }

      if (!AI_AGENT_URL) {
        return res.status(500).json({
          message:
            "AI_AGENT_URL is not configured on backend. Please set it in .env",
        });
      }

      // 1) Trích text từ file (pdf/doc/ppt...) bằng service cũ
      const rawText = await extractTextFromDocUrl(docUrl);
      const lessonText = (rawText || "").trim();
      if (!lessonText) {
        return res
          .status(400)
          .json({ message: "No readable text extracted from document." });
      }

      // 2) Gửi sang Python slides_agent (prompt đã nằm bên đó)
      const payload = {
        lesson_id: `temp-${Date.now()}`,
        lesson_title: "Temporary lesson",
        lesson_text: lessonText,
        num_slides: maxSlides || 10,
      };

      const resp = await axios.post(
        `${AI_AGENT_URL}/generate-slides`,
        payload,
        { timeout: 60000 }
      );

      const slides = Array.isArray(resp.data?.slides)
        ? resp.data.slides
        : [];

      return res.json({ slides });
    } catch (err) {
      console.error("[aiSlidesRoutes] /generate error:", err.response?.data || err);
      return res
        .status(500)
        .json({ message: "Failed to generate slides with AI" });
    }
  }
);

module.exports = router;
