const express = require("express");
const router = express.Router();
const { 
    createTest, getMyTests, getOneTest, updateTest, deleteTest, 
    listPublicTests, getPublicTestById, gradeEssay, submitTest, updateEssayGrade,
    getTestLeaderboard, getTestResultById, triggerAIGrading, getAdminTests, reviewTest,
} = require("../controllers/testController");
const { auth, authorize } = require("../middleware/auth");

// Public route to list all public tests
router.get("/public", listPublicTests);
router.get("/public/:id", getPublicTestById);
router.get("/public/:id/leaderboard", getTestLeaderboard);

// Admin routes
router.get("/admin/list", auth, authorize("admin"), getAdminTests);
router.patch("/admin/:id/review", auth, authorize("admin"), reviewTest);

// Protected routes for instructors
router.get("/", auth, authorize("instructor"), getMyTests);
router.post("/", auth, authorize("instructor"), createTest);
router.get("/:id", auth, authorize("instructor"), getOneTest);
router.patch("/:id", auth, authorize("instructor"), updateTest);
router.delete("/:id", auth, authorize("instructor"), deleteTest);

router.post("/grade-essay", auth, gradeEssay);
router.post("/submit", auth, submitTest);
router.post("/update-grade", auth, updateEssayGrade);
router.get("/results/:resultId", auth, getTestResultById);
router.post("/trigger-ai-grading", auth, triggerAIGrading);

module.exports = router;
