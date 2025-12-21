const cloudinary = require('../cloudinaryConfig');
const multer = require('multer');
const path = require('path');

const allowedMimes = [
  // PDF
  'application/pdf',

  // Word
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

  // Text
  'text/plain',

  // Slides
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
];

const uploadDoc = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    console.log('>>> Incoming file:', file.originalname, file.mimetype);

    if (!file.mimetype) {
      return cb(new Error('Invalid file'));
    }
    if (!allowedMimes.includes(file.mimetype)) {
      return cb(
        new Error('Only PDF, Word, text, or slide files are allowed')
      );
    }
    cb(null, true);
  },
});

// Upload to Cloudinary as RAW, keep the file extension in public_id
const toCloudinaryDoc = (folder = 'BB_docs') => (req, res, next) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const originalName = req.file.originalname || 'document';

  // Get the extension (.pdf, .docx, .pptx, .txt...)
  let ext = (path.extname(originalName) || '').toLowerCase();
  const baseName = path.basename(originalName, ext);

  // sanitize filename
  const safeBase = baseName.replace(/[^a-zA-Z0-9_-]+/g, '_') || 'doc';

  // Keep the extension in public_id
  const publicId = ext ? `${safeBase}${ext}` : safeBase;

  const options = {
    folder,
    resource_type: 'raw',   // required for pdf/doc/ppt/txt
    public_id: publicId,    // includes extension
    use_filename: false,
    unique_filename: false,
    overwrite: false,
  };

  console.log('>>> Uploading to Cloudinary as:', options);

  const stream = cloudinary.uploader.upload_stream(
    options,
    (err, result) => {
      if (err) {
        console.error('Cloudinary error:', err);
        return res.status(500).json({
          message: 'Failed to upload document',
          error: err.message,
        });
      }

      // secure_url can include query/token
      console.log('>>> Cloudinary upload result:', {
        secure_url: result.secure_url,
        public_id: result.public_id,
        resource_type: result.resource_type,
        format: result.format,
      });

      req.fileUrl = result.secure_url;       // FE is used directly for iframes and TTS.
      req.cloudinaryPublicId = result.public_id;
      next();
    }
  );

  stream.end(req.file.buffer);
};

module.exports = { uploadDoc, toCloudinaryDoc };