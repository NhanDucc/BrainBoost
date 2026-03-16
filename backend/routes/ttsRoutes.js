const express = require("express");
const path = require('path');
const textToSpeech = require('@google-cloud/text-to-speech');
const { extractTextFromDocUrl } = require("../services/docTextService");

const router = express.Router();

// ==== Google Cloud TTS Client Configuration ====

// Resolve the path to the Service Account Key file to authenticate with Google Cloud.
const keyPath = path.join(__dirname, '..', 'google-tts-key.json');
const ttsClient = new textToSpeech.TextToSpeechClient({
    keyFilename: keyPath
});

// ==== Utility Functions ====

/**
 * Helper Function: chunkTextToSafeguardBytes
 * Google Cloud TTS has a strict limit of 5000 bytes per API request.
 * This function intelligently splits long text into smaller chunks (under 4000 bytes)
 * without breaking sentences in the middle, ensuring smooth audio playback.
 * * @param {String} text - The full text to be synthesized.
 * @param {Number} maxBytes - The maximum allowed bytes per chunk (default 4000 for safety).
 * @returns {Array} An array of text chunks safely sized for the API.
 */
function chunkTextToSafeguardBytes(text, maxBytes = 4000) {
  const chunks = [];
  let currentChunk = "";
    
  // Split the text by sentence-ending punctuation or newlines to maintain natural flow
  const sentences = text.split(/(?<=[.!?\n])/); 

  for (let sentence of sentences) {
    // Calculate the actual byte length (not character length) because special characters/accents take more bytes
    let sentenceBytes = Buffer.byteLength(sentence, 'utf8');
    let currentChunkBytes = Buffer.byteLength(currentChunk, 'utf8');

    // Edge case: If a single sentence exceeds the max byte limit (very rare)
    if (sentenceBytes > maxBytes) {
      if (currentChunk) chunks.push(currentChunk);
      // Force split the sentence in half to prevent API crash
      chunks.push(sentence.substring(0, Math.floor(maxBytes / 2))); 
      currentChunk = "";
      continue;
    }

    // If adding this sentence to the current chunk keeps it under the limit, append it
    if (currentChunkBytes + sentenceBytes < maxBytes) {
      currentChunk += sentence;
    } else {
      // Otherwise, push the current chunk to the array and start a new one
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = sentence;
    }
  }
    
  // Push any remaining text in the final chunk
  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

// ==== Routes ====

/**
 * * GET /api/tts/extract
 * Takes a document URL (e.g., from Cloudinary) and extracts readable plain text from it.
 * Used to prepare files (PDF, DOCX, TXT) for text-to-speech processing.
 */
router.get("/extract", async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ message: "Missing url parameter." });
  }

  try {
    // Call external service to extract text from the file
    const text = await extractTextFromDocUrl(url);

    if (!text) {
      return res
        .status(400)
        .json({ message: "No readable text extracted from document." });
    }

    return res.json({ text });
  } catch (err) {
    console.error("[TTS] extract error:", err);

    // Handle specific Cloudinary/Storage access errors
    if (err.response) {
      const status = err.response.status;
      if (status === 401 || status === 403) {
        return res.status(status).json({
          message:
            "Cloud storage denied access to this file (401/403). Please check Cloudinary access control / hotlink settings.",
        });
      }
    }

    // Handle unsupported file types
    if (err.statusCode === 415) {
      return res.status(415).json({ message: err.message });
    }

    return res.status(500).json({
      message: "Failed to extract text for TTS.",
      error: err.message,
    });
  }
});

/**
 * * POST /api/tts/synthesize
 * Converts provided text into AI-generated speech audio using Google Cloud TTS.
 * Utilizes parallel processing for high-speed synthesis of large texts.
 */
router.post("/synthesize", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ message: "Text is required for synthesis." });
    }

    // Safely chunk the text to bypass the 5000-byte API limit
    const textChunks = chunkTextToSafeguardBytes(text, 4000);

    // Call the Google TTS API for all chunks simultaneously (Parallel Execution)
    // This drastically reduces waiting time compared to sequential processing.
    const synthesisPromises = textChunks.map(async (chunk) => {
      if (!chunk.trim()) return null; // Skip empty chunks
            
      const request = {
        input: { text: chunk },
        // Use Google's premium 'Journey' voice for highly expressive and natural audio
        voice: { languageCode: 'en-US', name: 'en-US-Journey-F' }, 
        audioConfig: { audioEncoding: 'MP3' },
      };

      const [response] = await ttsClient.synthesizeSpeech(request);
      return response.audioContent; // Returns an audio Buffer
    });

    // Wait for all parallel API calls to finish
    const audioBuffers = await Promise.all(synthesisPromises);

    // Filter out any null values from skipped empty chunks
    const validBuffers = audioBuffers.filter(buf => buf != null);

    // Concatenate all the individual audio buffers into one seamless MP3 file
    const combinedBuffer = Buffer.concat(validBuffers);
        
    // Convert the final binary buffer to a Base64 string so the frontend can play it directly
    const combinedBase64 = combinedBuffer.toString('base64');

    res.json({ audioContent: combinedBase64 });
  } catch (error) {
    console.error("[TTS] Synthesize error:", error);
    res.status(500).json({ 
      message: "Failed to synthesize speech using AI.", 
      error: error.message 
    });
  }
});

module.exports = router;