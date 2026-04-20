const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    title: { 
        type: String, 
        required: true 
    },
    message: { 
        type: String, 
        required: true 
    },
    type: { 
        type: String, 
        enum: ['system', 'ai_grading', 'badge', 'leaderboard', 'content', 'support'], 
        default: 'system' 
    },
    isRead: { 
        type: Boolean, 
        default: false 
    },
    link: { 
        type: String, 
        default: ''
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model('Notification', notificationSchema);