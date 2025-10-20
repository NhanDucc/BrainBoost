const cloudinary = require('../cloudinaryConfig');
const multer = require('multer');

// Middleware to upload image to Cloudinary
exports.uploadImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const file = req.file; // The uploaded file
    const result = await cloudinary.uploader.upload(file.path, {
      folder: 'Images_of_BB',
      use_filename: true,
      unique_filename: false,
    });

    // Attach the URL of the uploaded image to the request object
    req.fileUrl = result.secure_url;

    // Continue to the next middleware
    next();
  } catch (error) {
    res.status(500).json({ message: 'Failed to upload image', error: error.message });
  }
};

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads');  // temporary directory for multer before uploading to Cloudinary
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);  // keep original file name
    }
});

const upload = multer({ storage });

module.exports = upload;