const express = require("express");
const router = express.Router();
const { auth, authorize } = require("../middleware/auth");
const {
    createCourse,
    getCourse,
    updateCourse,
    listCourses,
    listPublicCourses,
    getPublicCourseById,
    deleteCourse,
    generateLessonSlides,
    createLearningPath,
    markLessonProgress,
} = require("../controllers/courseController");
const { uploadDoc, toCloudinaryDoc } = require("../middleware/uploadDoc");

// POST /api/courses/upload-doc
router.post(
  "/upload-doc",
  auth,
  authorize("admin", "instructor"),
  (req, res, next) => {
    console.log(">>> /api/courses/upload-doc hit");
    next();
  },
  uploadDoc.single("file"),
  toCloudinaryDoc("BB_lecture_docs"),
  (req, res) => {
    return res.json({
      url: req.fileUrl,
      publicId: req.cloudinaryPublicId,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
    });
  }
);

// error handler riêng cho upload-doc (MULTER / CLOUDINARY)
router.use((err, req, res, next) => {
  if (req.path === "/upload-doc") {
    console.error("Upload-doc error:", err);
    return res.status(400).json({
      message: err.message || "Upload doc failed",
    });
  }
  next(err);
});

// --- AI slide generation for a lesson ---
// POST /api/courses/:courseId/sections/:secIndex/lessons/:lessonIndex/gen-slides
router.post(
  "/:courseId/sections/:secIndex/lessons/:lessonIndex/gen-slides",
  auth,
  authorize("admin", "instructor"),
  generateLessonSlides
);

// --- Public routes ---
router.get("/public", listPublicCourses);
router.get("/public/:id", getPublicCourseById);
router.post('/learning-path', createLearningPath);

// --- Private routes ---
router.get("/", auth, listCourses);
router.post("/", auth, authorize("admin", "instructor"), createCourse);
router.get("/:id", auth, getCourse);
router.patch("/:id", auth, authorize("admin", "instructor"), updateCourse);
router.delete("/:id", auth, authorize("admin", "instructor"), deleteCourse);
router.post("/:id/progress", auth, markLessonProgress);

module.exports = router;