const mongoose = require("mongoose");

const LessonSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        type: { type: String, enum: ["video", "article", "quiz"], required: true },
        durationMin: { type: Number, min: 0, default: null },
        contentUrl: { type: String, default: "" },
    },
    { _id: false }
);

const SectionSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        lessons: { type: [LessonSchema], default: [] },
    },
    { _id: false }
);

const CourseSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        slug: { type: String, default: "", trim: true },
        subject: { type: String, enum: ["math", "english", "physics", "chemistry"], required: true },
        grade: { type: String, required: true, trim: true },

        description: { type: String, default: "" },
        tags: { type: [String], default: [] },
        price: { type: Number, min: 0, default: null },

        visibility: { type: String, enum: ["draft", "published"], default: "draft" },
        coverUrl: { type: String, default: "" },

        sections: { type: [SectionSchema], default: [] },

        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Course", CourseSchema);