const mongoose = require("mongoose");

const testResultSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    test: { type: mongoose.Schema.Types.ObjectId, ref: "Test", required: true },
    
    answers: [{
        questionId: String,
        type: { type: String }, 
        studentAnswer: mongoose.Schema.Types.Mixed,
        isCorrect: Boolean,
        score: Number, 
        aiFeedback: String,
        aiSuggestion: String
    }],

    totalScore: { type: Number, default: 0 },   
    maxScore: { type: Number, default: 0 },     
    finalPercent: Number,                       
    timeSpent: { type: Number, default: 0 },
    completedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("TestResult", testResultSchema);