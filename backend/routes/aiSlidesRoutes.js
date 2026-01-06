// backend/routes/aiSlidesRoutes.js
const express = require("express");
const router = express.Router();

const { auth, authorize } = require("../middleware/auth");
const { extractTextFromDocUrl } = require("../services/docTextService");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ===== Helper: tạo slide “fake” khi AI không hoạt động (dev mode) =====
function buildFallbackSlides(rawText, maxSlides) {
  const slides = [];
  if (!rawText) return slides;

  const safeMax = maxSlides && maxSlides > 0 ? maxSlides : 8;
  const text = rawText.replace(/\s+/g, " ").trim();
  if (!text) return slides;

  const chunkSize = Math.max(300, Math.floor(text.length / safeMax));

  let idx = 0;
  let i = 0;
  while (i < text.length && idx < safeMax) {
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
      const rawText = await extractTextFromDocUrl(docUrl);
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

        Your job is to design an engaging slide deck that will later be rendered with attractive visual styles (colors, icons, layouts) by the frontend. In this JSON, you ONLY provide clean, well-structured TEXT that is easy to turn into beautiful slides.

        From the lecture text below, create a clear slide deck with at most ${slideLimit} slides.
        Each slide should be short, focused, and suitable for reading on a screen.

        CONTENT RULES:
        - Use ONLY information that is explicitly present in the lecture text.
        - Do NOT invent new facts, examples, stories, analogies, formulas, or definitions.
        - You may paraphrase and simplify, but the meaning must stay faithful to the source.
        - Do NOT add your own opinions or extra ideas.

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

        FORMAT RULES:
        - "index" starts from 1 and increases by 1.
        - "title" must be concise and descriptive (max 80 characters), and feel like a strong visual heading for the slide.
        - "bullets" is an array of 2–5 short bullet strings (no nested lists, no numbering).
          * Each bullet should highlight a single key idea, definition, example, or step.
          * Write bullets so that they will look engaging when rendered on a slide (clear, concrete, not too long), but keep them as plain text here.
        - "ttsText" MUST be plain text (no bullet marks, no markdown, no HTML, no emojis).
          * "ttsText" is a natural-sounding spoken explanation for this slide (max 300 characters).
          * It must only describe content that is actually in this slide and in the original lecture text.
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

      // Fallback: tự cắt text thành slide nếu bật cờ
      const enableFallback =
        process.env.AI_SLIDES_FALLBACK === "1" ||
        process.env.AI_SLIDES_FALLBACK === "true";

      if (enableFallback) {
        try {
          const rawText = await extractTextFromDocUrl(docUrl);
          const slides = buildFallbackSlides(rawText, slideLimit || 8);
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
