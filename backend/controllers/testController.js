const axios = require("axios");
const mongoose = require("mongoose");
const Test = require("../models/Test");
const TestResult = require("../models/TestResult");
const User = require('../models/User');
const Notification = require('../models/Notification');

// Retrieve the AI microservice URL from environment variables
const AI_AGENT_URL = process.env.AI_AGENT_URL;

// ==== Utility & Helper Functions ====

/**
 * Normalizes and formats question data to ensure consistency before saving to the database.
 * Maps incoming raw data into strict schema-compliant objects based on the question type.
 * @param {Object} q - The raw question object.
 * @returns {Object} The sanitized and formatted question object.
 */
function normalizeQuestion(q) {
  const t = (q.type || "mcq").toLowerCase();

  // Handle Multiple Choice Questions (MCQ)
  if (t === "mcq") {
    // Ensure exactly 4 choices exist and are strings
    const choices = Array.isArray(q.choices) && q.choices.length === 4
      ? q.choices.map(c => String(c ?? "").trim())
      : ["", "", "", ""];
    return {
      type: "mcq",
      stem: String(q.stem || "").trim(),
      choices,
      correctIndex: Number.isInteger(q.correctIndex) ? q.correctIndex : null,
      explanation: String(q.explanation || "").trim(),
      points: Number.isFinite(q.points) ? q.points : 1,
    };
  }

  // Handle True/False (Boolean) Questions
  if (t === "tf" || t === "boolean") {
    return {
      type: "boolean",
      stem: String(q.stem || "").trim(),
      // Support alternative field names for boolean answers
      correctBool: (typeof q.correctBool === "boolean")
        ? q.correctBool
        : (typeof q.answerBool === "boolean" ? q.answerBool : null),
      explanation: String(q.explanation || "").trim(),
      points: Number.isFinite(q.points) ? q.points : 1,
    };
  }

  // Handle Short Answer Questions
  if (t === "short_answer") {
    return {
      type: "short_answer",
      stem: String(q.stem || "").trim(),
      modelAnswer: String(q.modelAnswer || "").trim(),
      explanation: String(q.explanation || "").trim(),
      points: Number.isFinite(q.points) ? q.points : 1,
    };
  }

  // Handle Essay Questions (AI Graded)
  return {
    type: "essay",
    stem: String(q.stem || "").trim(),
    modelAnswer: String(q.modelAnswer || "").trim(),
    rubric: String(q.rubric || "").trim(),
    explanation: String(q.explanation || "").trim(),
    points: Number.isFinite(q.points) ? q.points : 1,
  };
}

/**
 * Validates an array of questions at the controller level for early error detection.
 * Ensures required fields are present before attempting database operations.
 * @param {Array} qs - Array of question objects.
 * @returns {String|null} Returns an error message string if invalid, or null if valid.
 */
function validateQuestions(qs) {
  if (!Array.isArray(qs) || qs.length < 1) return "At least 1 question required.";
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i];
    if (!q.stem) return `Question ${i + 1}: stem is required.`;

    // Checks for required fields and proper format based on question type
    if (q.type === "mcq") {
      if (!Array.isArray(q.choices) || q.choices.length !== 4)
        return `Question ${i + 1}: MCQ must have 4 choices.`;
      if (!Number.isInteger(q.correctIndex))
        return `Question ${i + 1}: MCQ correct answer is missing.`;
    }

    if (q.type === "boolean" && typeof q.correctBool !== "boolean") {
      return `Question ${i + 1}: please choose True or False.`;
    }

    if (q.type === "short_answer" && !(q.modelAnswer || "").trim()) {
      return `Question ${i + 1}: Short answer must have a correct model answer.`;
    }
  }
  return null;  // No errors
}

// ==== Test Management Controllers ====

/**
 * * POST /api/tests
 * Creates a new test with validated questions and required metadata.
 * Initializes the test with a "pending" visibility to enforce Admin moderation.
 */
const createTest = async (req, res) => {
  try {
    const p = req.body || {};

    // Validate required top-level metadata
    if (!p.title || !p.grade || !p.subject)
      return res.status(400).json({ message: "Missing required fields." });

    // Normalize and validate the question array
    const questions = (p.questions || []).map(normalizeQuestion);
    const err = validateQuestions(questions);
    if (err) return res.status(400).json({ message: "Invalid question format.", detail: err });

    // Save to database
    const doc = await Test.create({
      title: String(p.title).trim(),
      grade: String(p.grade).trim(),
      subject: p.subject,
      tags: p.tags || [],
      description: p.description || "",
      numQuestions: questions.length,
      questions,
      createdBy: req.userId || null,
      visibility: "pending",
      adminFeedback: ""
    });

    res.status(201).json({ id: doc._id, message: "Created" });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "Invalid question format.", error: err.message });
  }
};

/**
 * Retrieves a list of tests. If '?mine=1' is provided, it fetches tests created 
 * by the authenticated instructor, including the number of attempts for each test.
 * * GET /api/tests?mine=1
 */
const getMyTests = async (req, res) => {
  try {
    const mine = String(req.query.mine || "") === "1";
    // If 'mine' is true, filter by the current user's ID
    const query = mine ? { createdBy: req.userId } : {};

    // Fetch the list of tests from database
    const list = await Test.find(query).sort({ updatedAt: -1 }).lean();

    // Count the number of student attempts for each test if viewed by the instructor
    if (mine) {
        const TestResult = require("../models/TestResult");
        for (let test of list) {
            const attemptsCount = await TestResult.countDocuments({ test: test._id });
            test.attempts = attemptsCount; // Attach attempt count to the response object
        }
    }
    
    res.json(list);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Retrieves a single test by ID and verifies that the requester is the test creator.
 * * GET /api/tests/:id
 */
const getOneTest = async (req, res) => {
  try {
    const t = await Test.findById(req.params.id).lean();
    if (!t) return res.status(404).json({ message: "Not found" });

    // Authorization check: Only the creator can fetch the test editor details
    if (String(t.createdBy) !== String(req.userId))
      return res.status(403).json({ message: "Forbidden" });
    res.json(t);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * * PUT /api/tests/:id
 * Updates an existing test. Checks permissions and validates new questions.
 * Returns the test to a "pending" status to ensure the newly edited content is reviewed.
 */
const updateTest = async (req, res) => {
  try {
    const doc = await Test.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });

    // Authorization check
    if (String(doc.createdBy) !== String(req.userId))
      return res.status(403).json({ message: "Forbidden" });

    const p = req.body || {};
    const questions = Array.isArray(p.questions) ? p.questions.map(normalizeQuestion) : null;
    
    // If questions are provided, validate and update them
    if (questions) {
      const err = validateQuestions(questions);
      if (err) return res.status(400).json({ message: "Invalid question format.", detail: err });
      doc.questions = questions;
      doc.numQuestions = questions.length;
    } else if (typeof p.numQuestions === "number") {
      doc.numQuestions = p.numQuestions;
    }

    // Update metadata fields, falling back to existing values if not provided
    doc.title = p.title ?? doc.title;
    doc.grade = p.grade ?? doc.grade;
    doc.subject = p.subject ?? doc.subject;
    doc.tags = Array.isArray(p.tags) ? p.tags : doc.tags;
    doc.description = p.description ?? doc.description;

    // Reset moderation status automatically when an instructor edits the test
    doc.visibility = "pending";
    doc.adminFeedback = "";

    await doc.save();
    res.json({ message: "Test updated and submitted for review." });
  } catch (e) {
    console.error(e);
    res.status(400).json({ message: "Invalid question format.", error: e.message });
  }
};

/**
 * Deletes a test from the database after verifying the user's permissions.
 * * DELETE /api/tests/:id
 */
const deleteTest = async (req, res) => {
  try {
    const t = await Test.findById(req.params.id);
    if (!t) return res.status(404).json({ message: "Not found" });
    
    // Authorization check
    if (String(t.createdBy) !== String(req.userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await t.deleteOne();
    res.json({ message: "Deleted" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

// ==== Student Facing Controllers ====

/**
 * * GET /api/public/tests
 * Lists public tests for students to view, with optional filtering by subject and search query.
 * Enforces security by only returning tests with the "published" visibility status.
 */
const listPublicTests = async (req, res) => {
  try {
    const { q = "", subject } = req.query;

    // Core security rule: Only fetch tests that have been approved by an Admin
    const cond = { visibility: "published" };

    // Apply subject filter if provided
    if (subject) cond.subject = subject;

    // Apply search query against title or description (case-insensitive)
    if (q) cond.$or = [
      { title: { $regex: q, $options: "i" } },
      { description: { $regex: q, $options: "i" } },
    ];

    // Fetch and return a lightweight projection of the tests
    const list = await Test.find(cond)
      .select("_id title subject grade numQuestions description tags updatedAt")
      .sort({ updatedAt: -1 })
      .lean();

    res.json(list);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Retrieves a public test by ID for students to take (contains full questions).
 * * GET /api/public/tests/:id
 */
const getPublicTestById = async (req, res) => {
  try {
    const doc = await Test.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: "Test not found" });
    res.json(doc);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Sends a student's essay answer to the external Python AI Agent for grading.
 * Note: This acts as a proxy between the frontend and the AI microservice.
 * * POST /api/tests/grade-essay
 */
const gradeEssay = async (req, res) => {
  try {
    const { question, student_answer, model_answer } = req.body;

    if (!question || !student_answer) {
      return res.status(400).json({ message: "Missing info" });
    }

    // Forward the request to the Python AI Agent
    const aiRes = await axios.post(`${AI_AGENT_URL}/grade-essay`, {
      question,
      student_answer,
      model_answer: model_answer || ""
    });

    return res.json(aiRes.data);

  } catch (err) {
    console.error("Grade Essay Error:", err.message);
    res.status(500).json({ message: "AI Grading Failed" });
  }
};

/**
 * Saves the test result when a student submits their test.
 * Includes background logic to monitor leaderboard changes and send notifications.
 * * POST /api/tests/submit
 */
const submitTest = async (req, res) => {
  try {
    const { testId, answers, resultSummary, timeSpent } = req.body;
    // answers: Array of detailed answers sent from the frontend
    // resultSummary: Contains overall score { correctCount, gradableTotal, percent }

    const testObjectId = new mongoose.Types.ObjectId(testId);

    // Fetch Top 10 Leaderboard BEFORE the new submission is saved
    const beforeLeaderboard = await TestResult.aggregate([
      { $match: { test: testObjectId } },
      { $sort: { totalScore: -1, timeSpent: 1, completedAt: 1 } },
      { $group: { _id: "$student", bestScore: { $first: "$totalScore" }, bestTime: { $first: "$timeSpent" } } },
      { $sort: { bestScore: -1, bestTime: 1 } },
      { $limit: 10 }
    ]);

    // Create a dictionary to map user IDs to their old ranks
    const rankBefore = {};
    beforeLeaderboard.forEach((user, index) => {
        rankBefore[user._id.toString()] = index + 1;
    });

    // Save the new test result to the database
    const newResult = await TestResult.create({
      student: req.userId,
      test: testId,
      answers: answers,
      totalScore: resultSummary.correctCount,
      maxScore: resultSummary.gradableTotal,
      finalPercent: resultSummary.percent,
      timeSpent: timeSpent || 0
    });

    // Fetch Top 10 Leaderboard AFTER the submission is saved
    const afterLeaderboard = await TestResult.aggregate([
      { $match: { test: testObjectId } },
      { $sort: { totalScore: -1, timeSpent: 1, completedAt: 1 } },
      { $group: { _id: "$student", bestScore: { $first: "$totalScore" }, bestTime: { $first: "$timeSpent" } } },
      { $sort: { bestScore: -1, bestTime: 1 } },
      { $limit: 10 }
    ]);

    // Run a background job to send notifications regarding leaderboard changes.
    // Executed asynchronously so the user gets an immediate API response.
    (async () => {
      try {
        const currentUserStr = req.userId.toString();
        const testInfo = await Test.findById(testId).select('title');
        const currentUser = await User.findById(req.userId).select('fullname');
        const afterIds = afterLeaderboard.map(u => u._id.toString());

        // Check for users in the new Top 10 who dropped in rank
        for (let i = 0; i < afterLeaderboard.length; i++) {
          const userIdStr = afterLeaderboard[i]._id.toString();
          const newRank = i + 1;
          const oldRank = rankBefore[userIdStr];

          // If rank dropped (e.g., from 1 to 2) AND it's not the user who just submitted
          if (oldRank && newRank > oldRank && userIdStr !== currentUserStr) {
            const userDoc = await User.findById(userIdStr);
            if (userDoc && userDoc.preferences?.notifyLeaderboard) {
              await Notification.create({
                user: userDoc._id,
                title: 'Leaderboard Alert!',
                message: `${currentUser.fullname} just beat your score on "${testInfo.title}"! You dropped to Rank #${newRank}.`,
                type: 'leaderboard',
                link: `/tests/${testId}`
              });
            }
          }
        }

        // Check for users who were pushed completely out of the Top 10
        for (const oldUserId in rankBefore) {
          if (!afterIds.includes(oldUserId) && oldUserId !== currentUserStr) {
            const userDoc = await User.findById(oldUserId);
            if (userDoc && userDoc.preferences?.notifyLeaderboard) {
              await Notification.create({
                user: userDoc._id,
                title: 'Leaderboard Alert!',
                message: `${currentUser.fullname} pushed you out of the Top 10 on "${testInfo.title}". Try again to reclaim your spot!`,
                type: 'leaderboard',
                link: `/tests/${testId}`
              });
            }
          }
        }
      } catch (error) {
        console.error("Leaderboard Notification Error:", error);
      }
    })();

    res.status(201).json(newResult);
  } catch (error) {
    console.error("Submit Test Error:", error);
    res.status(500).json({ message: "Failed to save result" });
  }
};

/**
 * Updates the AI grade, feedback, and suggestion for a specific essay question in an existing result.
 * Typically called after manual grading trigger from the frontend.
 * * POST /api/tests/update-grade
 */
const updateEssayGrade = async (req, res) => {
  try {
    const { resultId, questionIdx, aiData } = req.body;
    // aiData: { score, feedback, suggestion }

    const result = await TestResult.findById(resultId);
    if (!result) return res.status(404).json({ message: "Result not found" });
    
    // Locate the specific answer inside the answers array using the 1-based index
    const targetAnswer = result.answers[questionIdx - 1];

    if (targetAnswer) {
      // Apply AI feedback to the document
      targetAnswer.score = aiData.score;
      targetAnswer.aiFeedback = aiData.feedback;
      targetAnswer.aiSuggestion = aiData.suggestion;
      
      // Notify mongoose that a sub-document array has been modified to ensure changes are saved
      result.markModified('answers'); 
      await result.save();

      // Send an in-app notification to the student about the newly graded essay
      const student = await User.findById(result.student);
      if (student && student.preferences?.notifyAIGrading) {
          await Notification.create({
              user: student._id,
              title: 'AI Grading Completed',
              message: `Your essay for Question ${questionIdx} has been successfully graded. Score: ${aiData.score}/10.`,
              type: 'ai_grading',
              link: `/results/${result._id}`
          });
      }
    }

    res.json({ message: "Grade updated" });
  } catch (error) {
    console.error("Update Grade Error:", error);
    res.status(500).json({ message: "Failed to update grade" });
  }
};

/**
 * Fetches the top 10 leaderboard for a specific test.
 * Uses MongoDB Aggregation to ensure each student only appears once with their best attempt.
 * * GET /api/tests/public/:id/leaderboard
 */
const getTestLeaderboard = async (req, res) => {
  try {
    const testId = new mongoose.Types.ObjectId(req.params.id);

    const leaderboardRaw = await TestResult.aggregate([
      // Filter: Only get results for this specific test
      { $match: { test: testId } },

      // Pre-sort: Highest score first -> Lowest time spent -> Earliest submission date
      { $sort: { totalScore: -1, timeSpent: 1, completedAt: 1 } },

      // Group by User: Because of the pre-sort, using $first grabs their absolute best attempt
      {
        $group: {
          _id: "$student",  // Group by student ID
          bestScore: { $first: "$totalScore" },
          bestTime: { $first: "$timeSpent" },
          maxScore: { $first: "$maxScore" },
          completedAt: { $first: "$completedAt" }
        }
      },

      // Final Sort: Rank the grouped users against each other
      { $sort: { bestScore: -1, bestTime: 1, completedAt: 1 } },

      // Limit: Only return the top 10 performers
      { $limit: 10 },

      // Join: Lookup the "users" collection to get the student's name and avatar
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "studentInfo"
        }
      },
      
      // Unwind: Flatten the studentInfo array into an object
      { $unwind: "$studentInfo" }
    ]);

    // Map the aggregated raw data into a clean structure for the frontend UI,
    // respecting user privacy preferences for anonymity.
    const leaderboard = leaderboardRaw.map((r, index) => ({
      rank: index + 1,
      user: r.studentInfo.fullname || "Unknown User",
      avatar: r.studentInfo.avatarUrl || "",
      isAnonymous: r.studentInfo.preferences?.isAnonymous || false,
      score: r.bestScore,
      maxScore: r.maxScore,
      timeSpent: r.bestTime,
      date: r.completedAt
    }));

    res.json(leaderboard);
  } catch (error) {
    console.error("Leaderboard Error:", error);
    res.status(500).json({ message: "Failed to fetch leaderboard" });
  }
};

/**
 * Retrieves the detailed results of a completed test (including questions and chosen answers).
 * Ensures students can only view their own test results.
 * * GET /api/tests/results/:resultId
 */
const getTestResultById = async (req, res) => {
    try {
        // Fetch TestResult and populate the original test structure
        const result = await TestResult.findById(req.params.resultId)
            .populate('test')
            .lean();
            
        if (!result) return res.status(404).json({ message: "Result not found" });
        
        // Authorization Check: Only allow the student who took the test to view the results
        if (String(result.student) !== String(req.userId)) {
            return res.status(403).json({ message: "Forbidden: You can only view your own results." });
        }
        
        res.json(result);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Server error" });
    }
};

/**
 * Triggers the AI grading process as a background job.
 * Allows the user to leave the page while the AI microservice processes the essay.
 * * POST /api/tests/trigger-ai-grading
 */
const triggerAIGrading = async (req, res) => {
    const { resultId, questionIdx } = req.body;

    // Respond immediately so the frontend UI doesn't block/hang
    res.json({ message: "AI grading started in the background." });

    // Execute the AI call in a detached asynchronous block
    (async () => {
        try {
            const result = await TestResult.findById(resultId).populate('test');
            if (!result) return;

            const qIndex = parseInt(questionIdx) - 1;
            const targetAnswer = result.answers[qIndex];
            const originalQuestion = result.test.questions[qIndex];

            if (!targetAnswer || !originalQuestion) return;

            // Send payload to Python AI Agent
            const aiRes = await axios.post(`${AI_AGENT_URL}/grade-essay`, {
                question: originalQuestion.stem,
                student_answer: targetAnswer.studentAnswer || "",
                model_answer: originalQuestion.modelAnswer || ""
            });

            const aiData = aiRes.data; // Expected: { score, feedback, suggestion }

            // Save the AI feedback into the database
            targetAnswer.score = aiData.score;
            targetAnswer.aiFeedback = aiData.feedback;
            targetAnswer.aiSuggestion = aiData.suggestion;
            
            result.markModified('answers');
            await result.save();

            // Dispatch an in-app notification when the background job completes
            const student = await User.findById(result.student);
            if (student && student.preferences?.notifyAIGrading) {
                await Notification.create({
                    user: student._id,
                    title: 'AI Grading Completed',
                    message: `Your essay for Question ${questionIdx} in "${result.test.title}" has been graded. Score: ${aiData.score}/10.`,
                    type: 'ai_grading',
                    link: `/results/${result._id}` 
                });
            }
        } catch (err) {
            console.error("Background AI Grading Failed:", err.message);
        }
    })();
};

// ==== Admin Moderation Controllers ====

/**
 * * GET /api/tests/admin/list
 * Admin only route: Retrieves tests based on their approval status (pending, published, rejected).
 * Populates instructor details so admins know who submitted the test content.
 */
const getAdminTests = async (req, res) => {
    try {
        const { status = "pending" } = req.query;
        const tests = await Test.find({ visibility: status })
            .populate('createdBy', 'fullname email')
            .sort({ updatedAt: -1 })
            .lean();
        res.json(tests);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Server error" });
    }
};

/**
 * * PATCH /api/tests/admin/:id/review
 * Admin only route: Approves or Rejects a test submission.
 * Saves admin feedback directly to the test document if rejected, to help instructors fix issues.
 */
const reviewTest = async (req, res) => {
    try {
        const { status, note } = req.body;

        // Prevent invalid statuses from polluting the database
        if (!["published", "rejected"].includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const t = await Test.findById(req.params.id);
        if (!t) return res.status(404).json({ message: "Test not found" });

        // Apply moderation decision
        t.visibility = status;
        t.adminFeedback = note || "";   // Store rejection reason (if any)
        await t.save();

        res.json({ message: `Test ${status}` });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = { 
  createTest, getMyTests, getOneTest, updateTest, deleteTest, 
  listPublicTests, getPublicTestById, gradeEssay, submitTest, updateEssayGrade,
  getTestLeaderboard, getTestResultById, triggerAIGrading, getAdminTests, reviewTest,
};