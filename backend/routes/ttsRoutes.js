const express = require('express');
const axios = require('axios');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const JSZip = require('jszip');
const { TextDecoder } = require('util');

const router = express.Router();

/**
 * Helper: detect file type from magic bytes if Content-Type is application/octet-stream
 */
function detectTypeFromBuffer(buf) {
  if (!buf || buf.length < 4) return null;

  // PDF: "%PDF"
  const header4 = buf.slice(0, 4).toString();
  if (header4 === '%PDF') return 'application/pdf';

  // DOC (OLE Compound File): d0 cf 11 e0 a1 b1 1a e1
  const first8Hex = buf.slice(0, 8).toString('hex');
  if (first8Hex === 'd0cf11e0a1b11ae1') {
    return 'application/msword';
  }

  // New Office formats (DOCX, PPTX, etc.) are zip files with the "PK" header
  const first2Hex = buf.slice(0, 2).toString('hex');
  if (first2Hex === '504b') {
    return 'application/zip-openxml';
  }

  // By default, it is treated as text
  return 'text/plain';
}

/**
 * Helper: read text from Office OpenXML (DOCX/PPTX) files using JSZip
 */
async function extractOpenXmlText(buffer, contentType) {
  const zip = await JSZip.loadAsync(buffer);
  const files = Object.keys(zip.files);

  // Guess file type if not clear
  let isDocx = contentType.includes(
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
  let isPptx = contentType.includes(
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  );

  if (!isDocx && !isPptx) {
    if (files.some((name) => name.startsWith('word/'))) {
      isDocx = true;
    } else if (files.some((name) => name.startsWith('ppt/'))) {
      isPptx = true;
    }
  }

  // DOCX → use mammoth
  if (isDocx) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  }

  // PPTX → browse XML slides, get <a:t>...</a:t>
  if (isPptx) {
    let text = '';
    const slideFiles = files
      .filter(
        (name) =>
          name.startsWith('ppt/slides/slide') && name.endsWith('.xml')
      )
      .sort(); // slide1, slide2, ...

    for (const fname of slideFiles) {
      const xml = await zip.files[fname].async('string');
      const matches = xml.match(/<a:t[^>]*>(.*?)<\/a:t>/g);
      if (matches) {
        for (const m of matches) {
          const inner = m.replace(/<\/?a:t[^>]*>/g, '');
          text += inner + ' ';
        }
        text += '\n\n';
      }
    }

    return text;
  }

  // Fallback
  return '';
}

// GET /api/tts/extract?url=<cloudinary-url>
router.get('/extract', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ message: 'Missing url parameter.' });
  }

  try {
    console.log('[TTS] Fetching file from:', url);

    // Download files from Cloudinary – use the EXACT URL that FE sent (with query/token)
    const resp = await axios.get(url, { responseType: 'arraybuffer' });

    console.log('[TTS] HTTP status from Cloudinary:', resp.status);
    console.log('[TTS] Response headers:', resp.headers);

    // axios returns ArrayBuffer -> convert to Buffer
    const buffer = Buffer.isBuffer(resp.data)
      ? resp.data
      : Buffer.from(resp.data);

    let contentType = (resp.headers['content-type'] || '').toLowerCase();
    console.log('[TTS] Raw content-type from Cloudinary:', contentType);

    // If it's application/octet-stream or empty -> automatically detect it using magic bytes
    if (!contentType || contentType === 'application/octet-stream') {
      const detected = detectTypeFromBuffer(buffer);
      console.log('[TTS] Detected type from magic bytes:', detected);
      if (detected) {
        contentType = detected;
      }
    }

    let text = '';

    // 1) Text file (txt)
    if (contentType.startsWith('text/')) {
      const decoder = new TextDecoder('utf-8');
      text = decoder.decode(buffer);
    }
    // 2) PDF
    else if (contentType.includes('application/pdf')) {
      console.log('[TTS] Using pdf-parse to extract PDF text...');
      const parsed = await pdfParse(buffer);
      text = parsed.text || '';
    }
    // 3) DOCX / PPTX / OpenXML zip
    else if (
      contentType.includes(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) ||
      contentType.includes(
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      ) ||
      contentType === 'application/zip-openxml'
    ) {
      console.log('[TTS] Using JSZip + mammoth to extract OpenXML text...');
      text = await extractOpenXmlText(buffer, contentType);
    }
    // 4) DOC (Office 97–2003) or DOCX incorrectly assigned content-type
    else if (contentType.includes('application/msword')) {
      console.log('[TTS] application/msword – trying OpenXML parser fallback...');
      try {
        // Try reading as DOCX (in case Cloudinary set wrong mimetype)
        text = await extractOpenXmlText(
          buffer,
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
        if (!text || !text.trim()) {
          return res.status(415).json({
            message:
              'Legacy .doc files are not fully supported for TTS. Please save as DOCX or PDF.',
          });
        }
      } catch (e) {
        console.error('[TTS] Fallback OpenXML parse for .doc failed:', e);
        return res.status(415).json({
          message:
            'Legacy .doc files are not fully supported for TTS. Please save as DOCX or PDF.',
        });
      }
    }
    // 5) PPT (PowerPoint 97–2003)
    else if (contentType.includes('application/vnd.ms-powerpoint')) {
      return res.status(415).json({
        message:
          'Legacy .ppt slides are not supported for TTS. Please save as PPTX or PDF.',
      });
    }
    // 6) Other types → not supported
    else {
      console.log('[TTS] Unsupported contentType after detection:', contentType);
      return res.status(415).json({
        message: `Unsupported file type for TTS: ${contentType}`,
      });
    }

    text = (text || '').replace(/\s+/g, ' ').trim();
    if (!text) {
      return res
        .status(400)
        .json({ message: 'No readable text extracted from document.' });
    }

    return res.json({ text });
  } catch (err) {
    console.error('[TTS] extract error:', err);

    if (err.response) {
      console.error('[TTS] Upstream status:', err.response.status);
      console.error(
        '[TTS] Upstream headers x-cld-error:',
        err.response.headers?.['x-cld-error']
      );

      if (err.response.status === 401 || err.response.status === 403) {
        return res.status(err.response.status).json({
          message:
            'Cloud storage denied access to this file (401/403). Please check Cloudinary access control / hotlink settings.',
        });
      }
    }

    return res.status(500).json({
      message: 'Failed to extract text for TTS.',
      error: err.message,
    });
  }
});

module.exports = router;