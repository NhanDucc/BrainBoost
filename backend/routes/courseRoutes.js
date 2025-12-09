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
} = require("../controllers/courseController");

// --- Public routes ---
router.get("/public", listPublicCourses);
router.get("/public/:id", getPublicCourseById);

// --- Private routes ---
router.get("/", auth, listCourses);
router.post("/", auth, authorize("admin", "instructor"), createCourse);
router.get("/:id", auth, getCourse);
router.patch("/:id", auth, authorize("admin", "instructor"), updateCourse);
router.delete("/:id", auth, authorize("admin", "instructor"), deleteCourse);

module.exports = router;