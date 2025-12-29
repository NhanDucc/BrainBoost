const express = require("express");
const { extractTextFromDocUrl } = require("../services/docTextService");

const router = express.Router();

// GET /api/tts/extract?url=<cloudinary-url>
router.get("/extract", async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ message: "Missing url parameter." });
  }

  try {
    const text = await extractTextFromDocUrl(url);

    if (!text) {
      return res
        .status(400)
        .json({ message: "No readable text extracted from document." });
    }

    return res.json({ text });
  } catch (err) {
    console.error("[TTS] extract error:", err);

    if (err.response) {
      const status = err.response.status;
      if (status === 401 || status === 403) {
        return res.status(status).json({
          message:
            "Cloud storage denied access to this file (401/403). Please check Cloudinary access control / hotlink settings.",
        });
      }
    }

    if (err.statusCode === 415) {
      return res.status(415).json({ message: err.message });
    }

    return res.status(500).json({
      message: "Failed to extract text for TTS.",
      error: err.message,
    });
  }
});

module.exports = router;
