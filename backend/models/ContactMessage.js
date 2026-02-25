const mongoose = require('mongoose');

/**
 * ContactMessage Schema
 * Defines the structure for storing user contact and support messages in the database.
 */
const contactMessageSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, required: true },
    category: { type: String, default: 'General' },
    orderId: { type: String },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('ContactMessage', contactMessageSchema);