const mongoose = require("mongoose");

// Slide AI (lưu theo dạng cấu trúc, sau này FE có thể render từng slide)
const AiSlideSchema = new mongoose.Schema(
    {
        index: { 
            type: Number, 
            required: true 
        },             
        title: { 
            type: String, 
            required: true, 
            trim: true 
        },
        bullets: { type: [String], default: [] },
        // text dùng cho TTS: có thể = bullets.join(". ") hoặc đoạn tóm tắt slide
        ttsText: { type: String, default: "" },
    },
    { _id: false }
);

const LessonSchema = new mongoose.Schema(
    {
        title: { 
            type: String, 
            required: true, 
            trim: true 
        },
        type: {
        type: String,
        enum: ["lesson", "quiz"],
        required: true,
        },
        durationMin: { type: Number, min: 0, default: null },

        // URL tài nguyên chính (hiện đang dùng để hiển thị ở CoursePlayer)
        // với bài tài liệu: pdf / docx / pptx / txt (Cloudinary URL)
        contentUrl: { type: String, default: "" },

        // nếu muốn tách riêng file gốc (phòng sau này đổi contentUrl)
        originalDocUrl: { type: String, default: "" },   // Cloudinary URL file gốc
        originalDocType: { type: String, default: "" },  // "pdf" / "docx" / "pptx" / "txt" ...

        // slide do AI sinh
        aiSlides: { type: [AiSlideSchema], default: [] },

        // học sinh có được xem slide AI không?
        // (CoursePlayer đang đọc trường này để bật tab "AI slides (beta)")
        useAiSlides: { type: Boolean, default: false },

        // học sinh có được xem file gốc trên giao diện "Original document" không?
        // (CoursePlayer đang đọc useOriginalDoc; nếu field này không có thì fallback = đã có file)
        useOriginalDoc: { type: Boolean, default: true },
    },
    { _id: false }
);

const SectionSchema = new mongoose.Schema(
    {
        title: { 
            type: String, 
            required: true, 
            trim: true },
        lessons: { type: [LessonSchema], default: [] },
    },
    { _id: false }
);

const CourseSchema = new mongoose.Schema(
    {
        title: { 
            type: String, 
            required: true, 
            trim: true 
        },
        slug: { 
            type: String, 
            default: "", 
            trim: true 
        },
        subject: {
            type: String,
            enum: ["math", "english", "physics", "chemistry"],
            required: true,
        },
        grade: { type: String, required: true, trim: true },

        description: { type: String, default: "" },
        tags: { type: [String], default: [] },
        price: { type: Number, min: 0, default: null },

        visibility: { type: String, default: "published" },
        coverUrl: { type: String, default: "" },

        sections: { type: [SectionSchema], default: [] },

        createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Course", CourseSchema);