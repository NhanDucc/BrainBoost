const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    fullname: {
        type: String,
        required: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
    },
    password: {
        type: String,
        required: true,
    }, 
    // Extended fields (to be used in the future)
    phone: {
        type: String,
        default: '',
    },
    address: {
        type: String,
        default: '',
    },
    avatarUrl: {
        type: String,
        default: '',
    },
    bannerUrl: {
        type: String,
        default: '',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    role: { 
        type: String, 
        enum: ['student','instructor','admin'], 
        default: 'student' 
    },
    dateOfBirth: {
        type: Date,
        default: null
    },
    bio: {
        type: String,
        default: ''
    },
    study: {
        minutesByDay: { type: Map, of: Number, default: () => {} },
        submittedDays: [String]
    },
    }, 
    { timestamps: true });

userSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);
