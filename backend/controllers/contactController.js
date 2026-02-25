const nodemailer = require('nodemailer');
const User = require('../models/User');
const ContactMessage = require('../models/ContactMessage');

/**
 * Handles the submission of a contact form from the user.
 * Saves the message to the database and sends an email notification to the admin.
 */
exports.send = async (req, res) => {
    try {
        const { subject, category, orderId, message } = req.body;

        // Validate required fields
        if (!subject || !message) {
            return res.status(400).json({ message: 'Subject and Message are required.' });
        }

        // Retrieve the sender's details from the database using their authenticated ID
        const user = await User.findById(req.userId).select('fullname email');
        if (!user) return res.status(404).json({ message: 'User does not exist.' });

        // Save the incoming message to the database for the Admin dashboard
        await ContactMessage.create({
            user: req.userId,
            subject,
            category,
            orderId,
            message,
            isRead: false
        });

        // Configure the email transporter using Gmail SMTP
        const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER, // e.g. iiduc124@gmail.com
            pass: process.env.EMAIL_PASS  // 16-char app password (no spaces)
        }
        // Note: host/port/secure/tls are automatically handled by service: 'gmail'
        });

        // Verify the SMTP connection before sending (useful for debugging)
        try { await transporter.verify(); } catch (e) {
            console.error('SMTP verify failed:', e);
        }

        // Construct the HTML email template
        const html = `
        <div style="font-family:Arial,sans-serif;font-size:14px;color:#333">
            <h2>New Contact Message</h2>
            <table cellpadding="6" cellspacing="0" style="border-collapse:collapse">
            <tr><td><b>From</b></td><td>${user.fullname} &lt;${user.email}&gt;</td></tr>
            <tr><td><b>Category</b></td><td>${category || 'General'}</td></tr>
            ${orderId ? `<tr><td><b>Order/Course</b></td><td>${orderId}</td></tr>` : ''}
            <tr><td><b>Submitted at</b></td><td>${new Date().toLocaleString()}</td></tr>
            </table>
            <hr/>
            <div style="white-space:pre-wrap">${message}</div>
        </div>
        `;

        return res.json({ message: 'Your contact request has been submitted. Please check your email for our response.' });

    } catch (err) {
        // Log detailed diagnostics for server-side debugging
        console.error('contact send error:', {
            name: err.name, code: err.code, command: err.command, message: err.message, stack: err.stack
        });

        // Provide helpful hints based on common SMTP errors
        let hint = '';
        if (err.code === 'EAUTH') hint = 'Invalid Gmail app password or Gmail blocked the sign-in.';
        else if (err.code === 'ENOTFOUND') hint = 'DNS/Network can’t reach Gmail.';
        else if (err.code === 'ETIMEDOUT' || err.code === 'ECONNECTION') hint = 'Network/Firewall is blocking SMTP.';

        return res.status(500).json({
            message: 'Failed to submit your contact request',
            error: hint || 'Mail transport error'
        });
    }
};

/**
 * Retrieves all unread contact messages for the Admin dashboard.
 * Populates the user's basic info to display the sender details.
 */
exports.getUnreadMessages = async (req, res) => {
    try {
        // Fetch messages where isRead is false, populate user details, and sort newest first
        const messages = await ContactMessage.find({ isRead: false })
            .populate('user', 'fullname email avatarUrl')
            .sort({ createdAt: -1 });
        res.json(messages);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch messages' });
    }
};

/**
 * Marks a specific contact message as read (resolving the ticket).
 */
exports.markAsRead = async (req, res) => {
    try {
        await ContactMessage.findByIdAndUpdate(req.params.id, { isRead: true });
        res.json({ message: 'Marked as read' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to mark as read' });
    }
};