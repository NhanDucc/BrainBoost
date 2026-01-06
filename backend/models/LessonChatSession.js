// backend/models/LessonChatSession.js
const mongoose = require("mongoose");

const lessonChatSessionSchema = new mongoose.Schema(
  {
    // user đang hỏi (lấy từ auth middleware)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // id khóa học (string như trong URL /api/courses/public/:courseId)
    courseId: {
      type: String,
      required: true,
    },

    // khóa định danh lesson cho user + course
    // bạn có thể truyền lesson._id từ frontend, hoặc fallback "secIndex:lessonIndex"
    lessonKey: {
      type: String,
      required: true,
    },

    // lưu tiêu đề lesson cho dễ debug
    lessonTitle: {
      type: String,
      default: "",
    },

    // tóm tắt toàn bộ hội thoại tới hiện tại
    summary: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Một user – một course – một lesson chỉ có 1 session tóm tắt
lessonChatSessionSchema.index(
  { userId: 1, courseId: 1, lessonKey: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "LessonChatSession",
  lessonChatSessionSchema
);
