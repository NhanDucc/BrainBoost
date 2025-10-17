const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

/**
 * Send email for registration or password reset
 * @param {string} to - email recipient
 * @param {string} otp - OTP
 * @param {string} type - email types: 'register' or 'forgot'
 */

exports.sendEmailOtp = async (to, otp, type) => {
    let subject, message;

    if (type === 'register') {
        subject = 'OTP Verification - BrainBoost';
        message = `
            <p>Thanks for signing up on <strong>BrainBoost</strong>.</p>
            <p>Your registration OTP is:</p>
        `;
    } else if (type === 'forgot') {
        subject = 'Reset Password OTP - BrainBoost';
        message = `
            <p>You requested to reset your password for <strong>BrainBoost</strong>.</p>
            <p>Your reset OTP is:</p>
        `;
    } else {
        throw new Error('Invalid email type');
    }

    const mailOptions = {
        from: `"BrainBoost" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2 style="color: #2d89ff;">Your OTP Code</h2>
                <p>Hello,</p>
                ${message}
                <h1>${otp}</h1>
                <p><i>This OTP is valid for 10 minutes.</i></p>
            </div>
        `
    };

    await transporter.sendMail(mailOptions);
};
