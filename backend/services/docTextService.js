// backend/services/docTextService.js
// Dùng để trích text từ file trên Cloudinary / URL bất kỳ
// Hỗ trợ: .txt, .pdf, .docx (các loại khác sẽ báo 415)

const axios = require("axios");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

/**
 * Tải file về dạng Buffer
 */
async function downloadAsBuffer(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

/**
 * Trích text từ PDF
 */
async function extractPdfText(buffer) {
  const data = await pdfParse(buffer);
  return (data.text || "").trim();
}

/**
 * Trích text từ DOCX
 */
async function extractDocxText(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return (result.value || "").trim();
}

/**
 * Chuẩn hóa URL để lấy phần extension (bỏ ? , # phía sau)
 */
function getCleanUrl(url) {
  const trimmed = String(url || "").trim();
  const qIdx = trimmed.indexOf("?");
  const hIdx = trimmed.indexOf("#");

  let cutAt = trimmed.length;
  if (qIdx !== -1 && hIdx !== -1) cutAt = Math.min(qIdx, hIdx);
  else if (qIdx !== -1) cutAt = qIdx;
  else if (hIdx !== -1) cutAt = hIdx;

  return trimmed.slice(0, cutAt);
}

/**
 * Hàm chính: nhận URL → trả về plain text
 * NẾU không hỗ trợ định dạng thì ném lỗi có statusCode = 415
 */
async function extractTextFromDocUrl(url) {
  if (!url) {
    const err = new Error("Missing document URL");
    err.statusCode = 400;
    throw err;
  }

  const clean = getCleanUrl(url).toLowerCase();

  // 1) TXT đơn giản
  if (clean.endsWith(".txt")) {
    const res = await axios.get(url, { responseType: "text" });
    return String(res.data || "").trim();
  }

  // 2) PDF
  if (clean.endsWith(".pdf")) {
    const buf = await downloadAsBuffer(url);
    return await extractPdfText(buf);
  }

  // 3) DOCX
  if (clean.endsWith(".docx")) {
    const buf = await downloadAsBuffer(url);
    return await extractDocxText(buf);
  }

  // 4) Các loại khác: hiện chưa hỗ trợ, báo 415 để route TTS xử lý
  const err = new Error(
    "Unsupported document type for TTS text extraction. Please upload PDF, DOCX or TXT."
  );
  err.statusCode = 415;
  throw err;
}

module.exports = {
  extractTextFromDocUrl,
};
