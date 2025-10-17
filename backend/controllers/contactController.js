// controllers/contactController.js
const nodemailer = require('nodemailer');
const User = require('../models/User');

exports.send = async (req, res) => {
    try {
        const { subject, category, orderId, message } = req.body;
        if (!subject || !message) {
        return res.status(400).json({ message: 'Subject and Message are required.' });
        }

        // Who is sending
        const user = await User.findById(req.userId).select('fullname email');
        if (!user) return res.status(404).json({ message: 'User does not exist.' });

        // ✅ Easiest, most robust Gmail setup (uses your Gmail app password)
        const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER, // e.g. iiduc124@gmail.com
            pass: process.env.EMAIL_PASS  // 16-char app password (no spaces)
        }
        // No host/port/secure/tls needed with `service: 'gmail'`
        });

        // Optional: verify connection (nice during dev)
        try { await transporter.verify(); } catch (e) {
        console.error('SMTP verify failed:', e);
        }

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

        const info = await transporter.sendMail({
        // MUST be the authenticated address for Gmail
            from: `"BrainBoost Contact" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER,                 // admin inbox
            replyTo: `${user.fullname} <${user.email}>`,// so admin can reply directly to the user
            subject: subject.substring(0, 150),
            html
        });

        console.log('Mail sent:', info.messageId);
        return res.json({ message: 'Your contact request has been submitted. Please check your email for our response.' });

    } catch (err) {
        // Give you real diagnostics in the server log and a helpful hint back to the client
        console.error('contact send error:', {
        name: err.name, code: err.code, command: err.command, message: err.message, stack: err.stack
        });

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
