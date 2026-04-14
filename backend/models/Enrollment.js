const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    course: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Course', 
        required: true 
    },
    enrolledAt: { 
        type: Date, 
        default: Date.now 
    },
    status: { 
        type: String, 
        enum: ['active', 'refunded', 'cancelled'], 
        default: 'active' 
    },
    paymentId: { 
        type: String, 
        default: () => 'mock_payment_' + Math.random().toString(36).substring(2, 10) 
    } // Placeholder cho mã giao dịch thật sau này
});

// Tạo index kép (compound index) để đảm bảo 1 user chỉ có thể mua 1 khóa học 1 lần duy nhất
enrollmentSchema.index({ user: 1, course: 1 }, { unique: true });

module.exports = mongoose.model('Enrollment', enrollmentSchema);