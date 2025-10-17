const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema(
  {
    stem: { type: String, required: true },
    choices: {
      type: [String],
      validate: v => Array.isArray(v) && v.length === 4,
      required: true
    },
    correctIndex: { type: Number, min: 0, max: 3, required: true },
    explanation: { type: String, default: "" }
  },
  { _id: false }
);

const TestSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    grade: { type: String, required: true }, // keep string for flexibility
    subject: {
      type: String,
      enum: ["math", "english", "physics", "chemistry"],
      required: true
    },
    tags: { type: [String], default: [] },     // ["Easy", "Medium", ...]
    description: { type: String, default: "" },
    numQuestions: { type: Number, required: true },
    questions: { type: [QuestionSchema], required: true },

    // who created
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Test", TestSchema);
