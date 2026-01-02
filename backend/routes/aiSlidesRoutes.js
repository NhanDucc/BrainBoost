// backend/routes/aiSlidesRoutes.js
const express = require("express");
const router = express.Router();

const { auth, authorize } = require("../middleware/auth");
const { extractTextFromRemoteFile } = require("../services/docTextService");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ===== Helper: tạo slide “fake” khi AI không hoạt động (dev mode) =====
function buildFallbackSlides(rawText, maxSlides) {
  const slides = [];
  if (!rawText) return slides;

  const text = rawText.replace(/\s+/g, " ").trim();
  const chunkSize = Math.max(300, Math.floor(text.length / maxSlides));

  let idx = 0;
  let i = 0;
  while (i < text.length && idx < maxSlides) {
    const chunk = text.slice(i, i + chunkSize);
    const title = `Slide ${idx + 1}`;
    const bullets = chunk.split(/\. +/).filter(Boolean).slice(0, 4);
    const ttsText = bullets.join(". ").slice(0, 350);

    slides.push({
      index: idx + 1,
      title,
      bullets,
      ttsText,
    });

    i += chunkSize;
    idx += 1;
  }
  return slides;
}

/**
 * POST /api/ai-slides/generate
 * Body: { docUrl: string, maxSlides?: number }
 */
router.post(
  "/generate",
  auth,
  authorize("admin", "instructor"),
  async (req, res) => {
    const { docUrl, maxSlides } = req.body || {};

    if (!docUrl || typeof docUrl !== "string") {
      return res.status(400).json({ message: "docUrl is required." });
    }

    const slideLimit =
      typeof maxSlides === "number" && maxSlides > 0 && maxSlides <= 20
        ? maxSlides
        : 10;

    try {
      // 1) Trích text từ file
      const rawText = await extractTextFromRemoteFile(docUrl);
      if (!rawText) {
        return res
          .status(400)
          .json({ message: "No readable text extracted from document." });
      }

      // 2) Nếu chưa cấu hình key → báo rõ
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          message:
            "Gemini API key is not configured on the server. Please set GEMINI_API_KEY in .env.",
        });
      }

      const text =
        rawText.length > 12000 ? rawText.slice(0, 12000) : rawText;

      // 3) Gọi Gemini
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const prompt = `
You are an instructional designer for high-school students.

From the lecture text below, create a clear slide deck with at most ${slideLimit} slides.
Each slide should be short, focused, and suitable for reading on a screen.

Return ONLY JSON with this exact structure:

{
  "slides": [
    {
      "index": 1,
      "title": "Short slide title",
      "bullets": ["point 1", "point 2", "point 3"],
      "ttsText": "One short paragraph (max 300 characters) that can be read aloud for this slide."
    }
  ]
}

Rules:
- "index" starts from 1 and increases by 1.
- "title" must be concise and descriptive (max 80 characters).
- "bullets" is an array of 2–5 short bullet strings (no nested lists, no numbering).
- "ttsText" MUST be plain text (no bullet marks, no markdown, no HTML).
- "ttsText" ≤ 300 characters per slide.
- Do NOT include any other top-level fields.
- Do NOT wrap the JSON in backticks or a code block.

Lecture text:
"""${text}"""
`;

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      });

      const raw = result.response.text();
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        console.error("[AI-SLIDES] JSON parse failed:", e, raw);
        return res.status(500).json({
          message: "AI did not return valid JSON for slides.",
        });
      }

      const slidesArr = Array.isArray(parsed.slides) ? parsed.slides : [];
      if (!slidesArr.length) {
        return res
          .status(500)
          .json({ message: "AI did not generate any slides." });
      }

      const slides = slidesArr.map((s, idx) => {
        const bullets = Array.isArray(s.bullets)
          ? s.bullets
              .map((b) => String(b || "").trim())
              .filter(Boolean)
          : [];

        let ttsText = (s.ttsText || "").toString().trim();
        if (!ttsText && bullets.length) {
          ttsText = bullets.join(". ") + ".";
        }
        if (ttsText.length > 400) {
          ttsText = ttsText.slice(0, 400);
        }

        return {
          index: Number.isInteger(s.index) ? s.index : idx + 1,
          title: (s.title || `Slide ${idx + 1}`).toString().trim(),
          bullets,
          ttsText,
        };
      });

      return res.json({ slides });
    } catch (err) {
      console.error("[AI-SLIDES] generate error:", err);

      const statusFromProvider = err.status || err.statusCode;

      // 403 từ Gemini (key suspended / không hợp lệ)
      if (statusFromProvider === 403) {
        return res.status(500).json({
          message:
            "The AI provider returned 403 (key suspended or project disabled). Please check your Gemini API key / billing.",
        });
      }

      // Nếu muốn: bật fallback slide tự cắt text khi AI hỏng
      const enableFallback =
        process.env.AI_SLIDES_FALLBACK === "1" ||
        process.env.AI_SLIDES_FALLBACK === "true";

      if (enableFallback) {
        try {
          const rawText = await extractTextFromRemoteFile(req.body.docUrl);
          const slides = buildFallbackSlides(rawText, maxSlides || 8);
          return res.json({ slides, _fallback: true });
        } catch (e2) {
          console.error("[AI-SLIDES] fallback failed:", e2);
        }
      }

      return res.status(500).json({
        message: "Failed to generate AI slides.",
        error: err.message,
      });
    }
  }
);

module.exports = router;
