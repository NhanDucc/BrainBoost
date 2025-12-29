// services/docTextService.js
const axios = require("axios");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const JSZip = require("jszip");
const { TextDecoder } = require("util");

/**
 * Detect content-type từ magic bytes nếu header không rõ
 */
function detectTypeFromBuffer(buf) {
  if (!buf || buf.length < 4) return null;

  // PDF: "%PDF"
  const header4 = buf.slice(0, 4).toString();
  if (header4 === "%PDF") return "application/pdf";

  // DOC (OLE): d0 cf 11 e0 a1 b1 1a e1
  const first8Hex = buf.slice(0, 8).toString("hex");
  if (first8Hex === "d0cf11e0a1b11ae1") {
    return "application/msword";
  }

  // Office OpenXML (docx/pptx) = zip "PK"
  const first2Hex = buf.slice(0, 2).toString("hex");
  if (first2Hex === "504b") {
    return "application/zip-openxml";
  }

  return "text/plain";
}

/**
 * Đọc text từ DOCX/PPTX (OpenXML) bằng JSZip
 */
async function extractOpenXmlText(buffer, contentType) {
  const zip = await JSZip.loadAsync(buffer);
  const files = Object.keys(zip.files);

  let isDocx = contentType.includes(
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
  let isPptx = contentType.includes(
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  );

  if (!isDocx && !isPptx) {
    if (files.some((name) => name.startsWith("word/"))) {
      isDocx = true;
    } else if (files.some((name) => name.startsWith("ppt/"))) {
      isPptx = true;
    }
  }

  // DOCX → dùng mammoth
  if (isDocx) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  }

  // PPTX → đọc <a:t>...</a:t> trong slide
  if (isPptx) {
    let text = "";
    const slideFiles = files
      .filter(
        (name) =>
          name.startsWith("ppt/slides/slide") && name.endsWith(".xml")
      )
      .sort();

    for (const fname of slideFiles) {
      const xml = await zip.files[fname].async("string");
      const matches = xml.match(/<a:t[^>]*>(.*?)<\/a:t>/g);
      if (matches) {
        for (const m of matches) {
          const inner = m.replace(/<\/?a:t[^>]*>/g, "");
          text += inner + " ";
        }
        text += "\n\n";
      }
    }

    return text;
  }

  return "";
}

/**
 * Hàm chính: tải file từ Cloudinary URL (hoặc URL khác) và trích text
 * ném Error có .statusCode khi loại file không hỗ trợ
 */
async function extractTextFromDocUrl(url) {
  try {
    const resp = await axios.get(url, { responseType: "arraybuffer" });

    const buffer = Buffer.isBuffer(resp.data)
      ? resp.data
      : Buffer.from(resp.data);

    let contentType = (resp.headers["content-type"] || "").toLowerCase();

    if (!contentType || contentType === "application/octet-stream") {
      const detected = detectTypeFromBuffer(buffer);
      if (detected) contentType = detected;
    }

    let text = "";

    if (contentType.startsWith("text/")) {
      const decoder = new TextDecoder("utf-8");
      text = decoder.decode(buffer);
    } else if (contentType.includes("application/pdf")) {
      const parsed = await pdfParse(buffer);
      text = parsed.text || "";
    } else if (
      contentType.includes(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) ||
      contentType.includes(
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      ) ||
      contentType === "application/zip-openxml"
    ) {
      text = await extractOpenXmlText(buffer, contentType);
    } else if (contentType.includes("application/msword")) {
      // .doc cũ → cố đọc như docx; nếu fail thì báo lỗi 415
      try {
        text = await extractOpenXmlText(
          buffer,
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        );
        if (!text || !text.trim()) {
          const err = new Error(
            "Legacy .doc files are not fully supported. Please save as DOCX or PDF."
          );
          err.statusCode = 415;
          throw err;
        }
      } catch (e) {
        const err = new Error(
          "Legacy .doc files are not fully supported. Please save as DOCX or PDF."
        );
        err.statusCode = 415;
        throw err;
      }
    } else if (
      contentType.includes("application/vnd.ms-powerpoint") // .ppt cũ
    ) {
      const err = new Error(
        "Legacy .ppt slides are not supported. Please save as PPTX or PDF."
      );
      err.statusCode = 415;
      throw err;
    } else {
      const err = new Error(
        `Unsupported file type for text extraction: ${contentType}`
      );
      err.statusCode = 415;
      throw err;
    }

    text = (text || "").replace(/\s+/g, " ").trim();
    return text;
  } catch (err) {
    // Preserve axios error (401/403…) để route xử lý
    throw err;
  }
}

module.exports = {
  extractTextFromDocUrl,
};
