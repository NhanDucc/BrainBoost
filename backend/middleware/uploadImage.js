const cloudinary = require('../cloudinaryConfig');
const multer = require('multer');

// 1) Nhận file vào RAM (buffer), không ghi ra ổ đĩa
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB, tùy chỉnh nếu cần
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

// 2) Đẩy buffer lên Cloudinary bằng upload_stream
//    - folder: thư mục Cloudinary, ví dụ 'brainboost/avatars'
const toCloudinary = (folder = 'Images_of_BB') => (req, res, next) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const options = {
    folder,
    resource_type: 'image',
    use_filename: true,
    unique_filename: false,
    // overwrite: true, // bật nếu muốn ghi đè theo tên
  };

  const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
    if (err) {
      return res
        .status(500)
        .json({ message: 'Failed to upload image', error: err.message });
    }

    // Gắn thông tin để controller dùng
    req.fileUrl = result.secure_url;
    req.cloudinaryPublicId = result.public_id;
    next();
  });

  // Đẩy buffer vào stream
  stream.end(req.file.buffer);
};

module.exports = { uploadImage, toCloudinary };