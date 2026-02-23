const mongoose = require('mongoose');

const lessonProgressSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    
    // Khóa định danh bài học (VD: "s0:l1" - Section 0, Lesson 1)
    lessonKey: { type: String, required: true }, 
    
    // Lưu môn học để dễ dàng tính toán thống kê (Mathematics, Physics...)
    subject: { type: String, required: true }, 
    
    // Số phút đã học bài này (dùng để cộng tổng thời gian)
    timeSpent: { type: Number, default: 20 }, 
    
    // Ngày học (Quan trọng để tô xanh lịch)
    lastAccessed: { type: Date, default: Date.now } 
}, { timestamps: true });

// Tránh lưu trùng 1 bài học nhiều lần trong ngày, ta có thể tự do cập nhật
module.exports = mongoose.model('LessonProgress', lessonProgressSchema);