const mongoose = require("mongoose");

/** Question schema with 3 types:
 * - mcq:      requires choices[4] + correctIndex (0..3)
 * - boolean:  requires correctBool (true/false)
 * - short_answer: requires modelAnswer (exact text match, auto-graded)
 * - essay:    optional rubric/modelAnswer, AI-graded
 */

const QuestionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["mcq", "boolean", "short_answer", "essay"],
      default: "mcq",
      required: true,
    },

    stem: { type: String, required: true },

    // MCQ fields
    choices: {
      type: [String],
      validate: {
        validator: function (v) {
          if (this.type !== "mcq") return true;
          return Array.isArray(v) && v.length === 4 && v.every(s => typeof s === "string" && s.trim().length > 0);
        },
        message: "MCQ must have exactly 4 non-empty choices.",
      },
      required: function () { return this.type === "mcq"; },
    },
    correctIndex: {
      type: Number,
      min: 0,
      max: 3,
      validate: {
        validator: function (v) {
          if (this.type !== "mcq") return true;
          return Number.isInteger(v);
        },
        message: "MCQ requires a correctIndex between 0 and 3.",
      },
      required: function () { return this.type === "mcq"; },
    },

    // TRUE/FALSE field
    correctBool: {
      type: Boolean,
      required: function () { return this.type === "boolean"; },
    },

    // ESSAY & SHORT_ANSWER fields
    rubric: { type: String, default: "" },
    modelAnswer: { type: String, default: "" },

    // Common
    explanation: { type: String, default: "" },
    points: { type: Number, default: 1, min: 0 },
  },
  { _id: false }
);

// Extra guard: ensure type-specific requirements
QuestionSchema.pre("validate", function (next) {
  if (this.type === "mcq") {
    if (!Array.isArray(this.choices) || this.choices.length !== 4) {
      return next(new Error("MCQ must have exactly 4 choices."));
    }
    if (!Number.isInteger(this.correctIndex)) {
      return next(new Error("MCQ must have a valid correctIndex."));
    }
  }
  if (this.type === "boolean" && typeof this.correctBool !== "boolean") {
    return next(new Error("Boolean question must have correctBool (true/false)."));
  }
  if (this.type === "short_answer" && (!this.modelAnswer || !this.modelAnswer.trim())) {
    return next(new Error("Short answer question must have a correct model answer."));
  }
  next();
});

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
