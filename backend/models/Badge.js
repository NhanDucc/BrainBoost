const mongoose = require('mongoose');

const badgeSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    iconUrl: { type: String, required: true },

    subject: { 
        type: String, 
        enum: ['math', 'physics', 'chemistry', 'english'],
        required: true 
    },

    rank: {
        type: String,
        enum: ['Explorer', 'Foundational', 'Insightful', 'Master', 'Scholarly', 'Enlightened'],
        required: true
    },

    category: { 
        type: String, 
        enum: ['FORMAT', 'AI_INTERACTION', 'SPECIAL'],
        default: 'FORMAT'
    },
    
    criteria: {
        questionType: { type: String, enum: ['short_answer', 'mcq', 'tf', 'essay', 'all'], required: true },
        targetCount: { type: Number, default: 0, required: true } 
    }
}, { timestamps: true });

module.exports = mongoose.model('Badge', badgeSchema);