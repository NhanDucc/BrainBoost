const mongoose = require("mongoose");

const testResultSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    test: { type: mongoose.Schema.Types.ObjectId, ref: "Test", required: true },
    
    answers: [{
        questionId: String,
        
        // --- SỬA LẠI DÒNG NÀY ---
        // Phải viết rõ { type: String } để Mongoose không hiểu nhầm
        type: { type: String }, 
        
        studentAnswer: mongoose.Schema.Types.Mixed, // Index (số) hoặc Text (chuỗi)
        isCorrect: Boolean,
        score: Number, 
        
        aiFeedback: String,
        aiSuggestion: String
    }],

    totalScore: { type: Number, default: 0 },   
    maxScore: { type: Number, default: 0 },     
    finalPercent: Number,                       
    
    completedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("TestResult", testResultSchema);