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
        enum: ['ai_grading', 'leaderboard', 'system'], 
        default: 'system' 
    },
    isRead: { 
        type: Boolean, 
        default: false 
    },
    link: { 
        type: String, 
        default: '' // Đường dẫn để khi người dùng click vào thông báo sẽ chuyển hướng đến đúng trang
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model('Notification', notificationSchema);