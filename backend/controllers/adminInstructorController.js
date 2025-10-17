const bcrypt = require('bcryptjs');
const User = require('../models/User');
const InstructorApplication = require('../models/InstructorApplication');
const { transporter } = require('../middleware/mailer');

const genPassword = (len = 10) =>
    Array.from(crypto.getRandomValues(new Uint32Array(len)))
        .map(n => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[n % 62])
        .join('');

const crypto = require('crypto');

exports.list = async (req, res) => {
    try {
        const { status = 'pending' } = req.query;
        const items = await InstructorApplication.find({ status })
        .sort({ createdAt: -1 });
        res.json(items);
    } catch (err) {
        res.status(500).json({ message: 'Fetch failed', error: err.message });
    }
};

exports.approve = async (req, res) => {
    try {
        const { id } = req.params;
        const { note } = req.body;

        const app = await InstructorApplication.findById(id);
        if (!app) return res.status(404).json({ message: 'Application not found' });
        if (app.status !== 'pending') return res.status(400).json({ message: 'Application already processed' });

        // Create/Update account
        let user = await User.findOne({ email: app.email });
        let tempPassword = null;

        if (!user) {
        tempPassword = genPassword(12);
        const hashed = await bcrypt.hash(tempPassword, 10);
        user = await User.create({
            fullname: app.fullName,
            email: app.email,
            phone: app.phone,
            bio: app.bio,
            password: hashed,
            role: 'instructor'
        });
        } else {
        // If an account already exists → upgrade the role
        if (user.role !== 'instructor' && user.role !== 'admin') {
            user.role = 'instructor';
            user.fullname ||= app.fullName;
            user.phone ||= app.phone;
            user.bio ||= app.bio;
            await user.save();
        }
        }

        app.status = 'approved';
        app.note = note || '';
        app.decidedAt = new Date();
        app.decidedBy = req.userId;
        await app.save();

        // Send notification email
        const html = `
        <div style="font-family:Arial,sans-serif;color:#333">
            <h2>Congratulations, ${app.fullName}!</h2>
            <p>Your application to become an instructor at <b>BrainBoost</b> has been approved.</p>
            ${
            tempPassword
                ? `<p>We created an instructor account for you.</p>
                <table cellpadding="6" style="border-collapse:collapse">
                    <tr><td><b>Email</b></td><td>${app.email}</td></tr>
                    <tr><td><b>Temporary password</b></td><td>${tempPassword}</td></tr>
                </table>
                <p><i>Please login and change your password immediately in My Profile &gt; Change password.</i></p>`
                : `<p>You can use your existing account <b>${app.email}</b>. Your role has been upgraded to <b>Instructor</b>.</p>`
            }
            ${note ? `<p><b>Note from admin:</b> ${note}</p>` : ''}
        </div>
        `;

        await transporter.sendMail({
        from: `"BrainBoost" <${process.env.EMAIL_USER}>`,
        to: app.email,
        subject: 'Your instructor application has been approved',
        html
        });

        res.json({ message: 'Approved and email sent.' });
    } catch (err) {
        res.status(500).json({ message: 'Approve failed', error: err.message });
    }
};

exports.reject = async (req, res) => {
    try {
        const { id } = req.params;
        const { note } = req.body;

        const app = await InstructorApplication.findById(id);
        if (!app) return res.status(404).json({ message: 'Application not found' });
        if (app.status !== 'pending') return res.status(400).json({ message: 'Application already processed' });

        app.status = 'rejected';
        app.note = note || '';
        app.decidedAt = new Date();
        app.decidedBy = req.userId;
        await app.save();

        const html = `
        <div style="font-family:Arial,sans-serif;color:#333">
            <h2>Hello ${app.fullName},</h2>
            <p>Thank you for your interest in becoming an instructor at <b>BrainBoost</b>. 
            Unfortunately, we cannot proceed with your application at this time.</p>
            ${note ? `<p><b>Note from admin:</b> ${note}</p>` : ''}
            <p>You can re-apply in the future with more information. Best regards!</p>
        </div>
        `;

        await transporter.sendMail({
        from: `"BrainBoost" <${process.env.EMAIL_USER}>`,
        to: app.email,
        subject: 'Your instructor application result',
        html
        });

        res.json({ message: 'Rejected and email sent.' });
    } catch (err) {
        res.status(500).json({ message: 'Reject failed', error: err.message });
    }
};
