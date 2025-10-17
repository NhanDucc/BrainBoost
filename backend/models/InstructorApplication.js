const mongoose = require('mongoose');

const InstructorApplicationSchema = new mongoose.Schema({
    fullName:   { type: String, required: true, trim: true },
    email:      { type: String, required: true, lowercase: true, trim: true },
    phone:      { type: String, default: '' },
    expertise:  { type: String, default: '' },
    experience: { type: Number, default: 0 },
    bio:        { type: String, default: '' },
    resumeUrl:  { type: String, default: '' },
    status:     { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
    note:       { type: String, default: '' },
    decidedAt:  { type: Date },
    decidedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

InstructorApplicationSchema.index({ email: 1, status: 1 });

module.exports = mongoose.model('InstructorApplication', InstructorApplicationSchema);