const mongoose = require("mongoose");

const lessonChatSessionSchema = new mongoose.Schema(
  {
    // The user is asking
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Course ID
    courseId: {
      type: String,
      required: true,
    },

    // Lesson ID
    lessonKey: {
      type: String,
      required: true,
    },

    // Save lesson title (optional)
    lessonTitle: {
      type: String,
      default: "",
    },
    
    // Save full history
    history: {
      type: [Object], // [{role: 'user', content: '...'}, ...]
      default: []
    }
  },
  {
    timestamps: true, // Automatically create createdAt, updatedAt
  }
);

// Index Unique: One user – one course – one lesson has only one session memory.
lessonChatSessionSchema.index(
  { userId: 1, courseId: 1, lessonKey: 1 },
  { unique: true }
);

// Automatically deleted after 10 days (864,000 seconds) from the last update.
lessonChatSessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 864000 });

module.exports = mongoose.model("LessonChatSession", lessonChatSessionSchema);