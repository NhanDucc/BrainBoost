// middleware/uploadDoc.js
const cloudinary = require('../cloudinaryConfig');
const multer = require('multer');
const path = require('path');

const allowedMimes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

const uploadDoc = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    console.log(">>> Incoming file:", file.originalname, file.mimetype);
    if (!file.mimetype) {
      return cb(new Error('Invalid file'));
    }
    if (!allowedMimes.includes(file.mimetype)) {
      return cb(new Error('Only PDF, Word, or text files are allowed'));
    }
    cb(null, true);
  },
});

const toCloudinaryDoc = (folder = 'BB_docs') => (req, res, next) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const originalName = req.file.originalname;
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext);

  const options = {
    folder,
    resource_type: 'raw',          // BẮT BUỘC với pdf/doc/docx/txt
    public_id: baseName,          // giữ nguyên tên (không có đuôi)
    use_filename: false,          // dùng đúng public_id mình set
    unique_filename: false,       // không tự thêm chuỗi random
    overwrite: false,             // nếu trùng tên thì báo lỗi
  };

  console.log(">>> Uploading to Cloudinary:", req.file.originalname);

  const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
    if (err) {
      console.error("Cloudinary error:", err);
      return res
        .status(500)
        .json({ message: 'Failed to upload document', error: err.message });
    }

    req.fileUrl = result.secure_url;
    req.cloudinaryPublicId = result.public_id;
    next();
  });

  stream.end(req.file.buffer);
};

module.exports = { uploadDoc, toCloudinaryDoc };