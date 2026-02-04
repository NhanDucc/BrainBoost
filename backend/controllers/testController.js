const axios = require("axios");
const Test = require("../models/Test");

const AI_AGENT_URL = process.env.AI_AGENT_URL;

// Normalizes and validates question data to ensure consistent format
function normalizeQuestion(q) {
  const t = (q.type || "mcq").toLowerCase();

  // multiple choice question
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

  // true/false question
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

  // essay
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
  return null;
}

// Creates a new test with validated questions and required fields
// POST /api/tests
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

// Retrieves tests based on query parameters
// GET /api/tests?mine=1
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

// Retrieves a single test by ID with permission check
// GET /api/tests/:id
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

// Updates an existing test with permission check
// PUT /api/tests/:id
const updateTest = async (req, res) => {
  try {
    const doc = await Test.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });
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

// Deletes a test with permission check
// DELETE /api/tests/:id
const deleteTest = async (req, res) => {
  try {
    const t = await Test.findById(req.params.id);
    if (!t) return res.status(404).json({ message: "Not found" });
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

// Lists public tests with optional filtering by subject and search query
// GET /api/public/tests
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

// Retrieves a public test by ID without showing answers
// GET /api/public/tests/:id
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

const gradeEssay = async (req, res) => {
  try {
    const { question, student_answer, model_answer } = req.body;

    if (!question || !student_answer) {
      return res.status(400).json({ message: "Missing info" });
    }

    // Gọi sang Python Agent
    const aiRes = await axios.post(`${process.env.AI_AGENT_URL}/grade-essay`, {
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
module.exports = { createTest, getMyTests, getOneTest, updateTest, deleteTest, listPublicTests, getPublicTestById, gradeEssay };