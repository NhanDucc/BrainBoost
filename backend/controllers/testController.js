const Test = require("../models/Test");

// CREATE
const createTest = async (req, res) => {
  try {
    const p = req.body;

    if (!p.title || !p.grade || !p.subject) {
      return res.status(400).json({ message: "Missing required fields." });
    }
    if (!Array.isArray(p.questions) || p.questions.length < 1) {
      return res.status(400).json({ message: "Questions are required." });
    }
    for (const q of p.questions) {
      if (!q?.stem || !Array.isArray(q.choices) || q.choices.length !== 4) {
        return res.status(400).json({ message: "Invalid question format." });
      }
      if (typeof q.correctIndex !== "number" || q.correctIndex < 0 || q.correctIndex > 3) {
        return res.status(400).json({ message: "Invalid correctIndex." });
      }
    }

    const doc = await Test.create({
      title: p.title,
      grade: p.grade,
      subject: p.subject,
      tags: p.tags || [],
      description: p.description || "",
      numQuestions: p.numQuestions || p.questions.length,
      questions: p.questions,
      createdBy: req.userId, // <--- fix
    });

    res.status(201).json({ id: doc._id, message: "Created" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// LIST (supports ?mine=1)
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

// READ ONE
const getOneTest = async (req, res) => {
  try {
    const t = await Test.findById(req.params.id).lean();
    if (!t) return res.status(404).json({ message: "Not found" });
    if (String(t.createdBy) !== String(req.userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    res.json(t);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

// UPDATE
const updateTest = async (req, res) => {
  try {
    const t = await Test.findById(req.params.id);
    if (!t) return res.status(404).json({ message: "Not found" });
    if (String(t.createdBy) !== String(req.userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const p = req.body;
    t.title = p.title ?? t.title;
    t.grade = p.grade ?? t.grade;
    t.subject = p.subject ?? t.subject;
    t.tags = Array.isArray(p.tags) ? p.tags : t.tags;
    t.description = p.description ?? t.description;

    if (Array.isArray(p.questions) && p.questions.length > 0) {
      t.questions = p.questions;
      t.numQuestions = p.questions.length;
    } else if (typeof p.numQuestions === "number") {
      t.numQuestions = p.numQuestions;
    }

    await t.save();
    res.json({ message: "Updated" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE
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

// LIST PUBLIC TESTS
const listPublicTests = async (req, res) => {
  try {
    const { q = "", subject } = req.query;
    const cond = {};
    if (subject) cond.subject = subject;        // e.g. "math"
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

// GET PUBLIC TEST BY ID (without answers)
const getPublicTestById = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Test.findById(id)
      .select("_id title subject grade description questions updatedAt")
      .lean();
    if (!doc) return res.status(404).json({ message: "Test not found" });
    res.json(doc);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { createTest, getMyTests, getOneTest, updateTest, deleteTest, listPublicTests, getPublicTestById };
