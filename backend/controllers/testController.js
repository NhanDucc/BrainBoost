const axios = require("axios");
const mongoose = require("mongoose");
const Test = require("../models/Test");
const TestResult = require("../models/TestResult");

const AI_AGENT_URL = process.env.AI_AGENT_URL;

// Normalizes and formats question data to ensure consistency before saving to the database
function normalizeQuestion(q) {
  const t = (q.type || "mcq").toLowerCase();

  // Handle Multiple Choice Questions
  if (t === "mcq") {
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
      correctBool: (typeof q.correctBool === "boolean")
        ? q.correctBool
        : (typeof q.answerBool === "boolean" ? q.answerBool : null),
      explanation: String(q.explanation || "").trim(),
      points: Number.isFinite(q.points) ? q.points : 1,
    };
  }

  // Handle Essay Questions
  return {
    type: "essay",
    stem: String(q.stem || "").trim(),
    modelAnswer: String(q.modelAnswer || "").trim(),
    rubric: String(q.rubric || "").trim(),
    explanation: String(q.explanation || "").trim(),
    points: Number.isFinite(q.points) ? q.points : 1,
  };
}

// Validates an array of questions at controller level for early error detection
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
  }
  return null;  // No errors
}

/**
 * Creates a new test with validated questions and required fields.
 * * POST /api/tests
 */
const createTest = async (req, res) => {
  try {
    const p = req.body || {};

    if (!p.title || !p.grade || !p.subject)
      return res.status(400).json({ message: "Missing required fields." });

    const questions = (p.questions || []).map(normalizeQuestion);
    const err = validateQuestions(questions);
    if (err) return res.status(400).json({ message: "Invalid question format.", detail: err });

    const doc = await Test.create({
      title: String(p.title).trim(),
      grade: String(p.grade).trim(),
      subject: p.subject,
      tags: p.tags || [],
      description: p.description || "",
      numQuestions: questions.length,
      questions,
      createdBy: req.userId || null,
    });

    res.status(201).json({ id: doc._id, message: "Created" });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "Invalid question format.", error: err.message });
  }
};

/**
 * Retrieves a list of tests created by the currently authenticated user.
 * * GET /api/tests?mine=1
 */
const getMyTests = async (req, res) => {
  try {
    const mine = String(req.query.mine || "") === "1";
    const query = mine ? { createdBy: req.userId } : {};
    const list = await Test.find(query).sort({ updatedAt: -1 }).lean();
    res.json(list);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Retrieves a single test by ID, checking that the requester is the test creator.
 * * GET /api/tests/:id
 */
const getOneTest = async (req, res) => {
  try {
    const t = await Test.findById(req.params.id).lean();
    if (!t) return res.status(404).json({ message: "Not found" });
    if (String(t.createdBy) !== String(req.userId))
      return res.status(403).json({ message: "Forbidden" });
    res.json(t);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Updates an existing test, checking permissions and validating new questions.
 * * PUT /api/tests/:id
 */
const updateTest = async (req, res) => {
  try {
    const doc = await Test.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });

    // Permission check
    if (String(doc.createdBy) !== String(req.userId))
      return res.status(403).json({ message: "Forbidden" });

    const p = req.body || {};
    const questions = Array.isArray(p.questions) ? p.questions.map(normalizeQuestion) : null;
    
    if (questions) {
      const err = validateQuestions(questions);
      if (err) return res.status(400).json({ message: "Invalid question format.", detail: err });
      doc.questions = questions;
      doc.numQuestions = questions.length;
    } else if (typeof p.numQuestions === "number") {
      doc.numQuestions = p.numQuestions;
    }

    doc.title = p.title ?? doc.title;
    doc.grade = p.grade ?? doc.grade;
    doc.subject = p.subject ?? doc.subject;
    doc.tags = Array.isArray(p.tags) ? p.tags : doc.tags;
    doc.description = p.description ?? doc.description;

    await doc.save();
    res.json({ message: "Updated" });
  } catch (e) {
    console.error(e);
    res.status(400).json({ message: "Invalid question format.", error: e.message });
  }
};

/**
 * Deletes a test after verifying the user's permissions.
 * * DELETE /api/tests/:id
 */
const deleteTest = async (req, res) => {
  try {
    const t = await Test.findById(req.params.id);
    if (!t) return res.status(404).json({ message: "Not found" });
    
    // Permission check
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

/**
 * Lists public tests with optional filtering by subject and search queries.
 * * GET /api/public/tests
 */
const listPublicTests = async (req, res) => {
  try {
    const { q = "", subject } = req.query;
    const cond = {};

    if (subject) cond.subject = subject;
    if (q) cond.$or = [
      { title: { $regex: q, $options: "i" } },
      { description: { $regex: q, $options: "i" } },
    ];

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
 * Retrieves a public test by ID for students to take.
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
 * Sends a student's essay answer to the external AI Agent for grading.
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
 * * POST /api/tests/submit
 */
const submitTest = async (req, res) => {
  try {
    const { testId, answers, resultSummary, timeSpent } = req.body;
    // answers: Array of detailed answers sent from the frontend
    // resultSummary: Contains overall score { correctCount, gradableTotal, percent }

    const newResult = await TestResult.create({
      student: req.userId,
      test: testId,
      answers: answers,
      totalScore: resultSummary.correctCount,
      maxScore: resultSummary.gradableTotal,
      finalPercent: resultSummary.percent,
      timeSpent: timeSpent || 0
    });

    res.status(201).json(newResult);
  } catch (error) {
    console.error("Submit Test Error:", error);
    res.status(500).json({ message: "Failed to save result" });
  }
};

/**
 * Updates the AI grade, feedback, and suggestion for a specific essay question.
 * * POST /api/tests/update-grade
 */
const updateEssayGrade = async (req, res) => {
  try {
    const { resultId, questionIdx, aiData } = req.body;
    // aiData: { score, feedback, suggestion }

    const result = await TestResult.findById(resultId);
    if (!result) return res.status(404).json({ message: "Result not found" });
    
    // If not found by ID, fall back to index position
    const targetAnswer = result.answers[questionIdx - 1];

    if (targetAnswer) {
      targetAnswer.score = aiData.score;
      targetAnswer.aiFeedback = aiData.feedback;
      targetAnswer.aiSuggestion = aiData.suggestion;
      
      // Notify mongoose that the answers array has been modified to trigger a save
      result.markModified('answers'); 
      await result.save();
    }

    res.json({ message: "Grade updated" });
  } catch (error) {
    console.error("Update Grade Error:", error);
    res.status(500).json({ message: "Failed to update grade" });
  }
};

/**
 * Fetches the leaderboard for a specific test.
 * Aggregates data so each student only appears once (with their highest score & lowest time).
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

    // Map the aggregated raw data into a clean structure for the frontend UI
    const leaderboard = leaderboardRaw.map((r, index) => ({
      rank: index + 1,
      user: r.studentInfo.fullname || "Unknown User",
      avatar: r.studentInfo.avatarUrl || "",
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

module.exports = { 
  createTest, getMyTests, getOneTest, updateTest, deleteTest, 
  listPublicTests, getPublicTestById, gradeEssay, submitTest, updateEssayGrade,
  getTestLeaderboard,
};