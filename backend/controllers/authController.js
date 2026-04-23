const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const emailValidator = require('email-validator');
const User = require('../models/User');
const Otp = require('../models/Otp');
const { sendEmailOtp } = require('../middleware/sendEmailOtp');
const { saveOtpToDB } = require('../middleware/otpHelper');

// ==== Configuration & Constants ====

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';
const CSRF_COOKIE = 'csrf_token';

const ACCESS_TTL = 15 * 60 * 1000; // 15 minutes (in milliseconds)
const REFRESH_TTL_NORMAL = 24 * 60 * 60 * 1000; // 1 day
const REFRESH_TTL_REMEMBER = 7 * 24 * 60 * 60 * 1000; // 7 days

// NOTE: Set to 'false' if running locally or on AWS without HTTPS.
// Must be 'process.env.NODE_ENV === "production"' when deployed with a valid SSL/HTTPS.
const IS_SECURE = false; 

// Temporary in-memory storage for user data during registration OTP verification.
// (Warning: In a scaled production environment, this should be moved to Redis or a DB collection)
const tempUserStore = {};

// ==== Helper Functions ====

/**
 * Generates a random 6-digit One-Time Password (OTP).
 * @returns {string} 6-digit numeric string
 */
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

/**
 * Returns the base configuration for setting or clearing cookies.
 * This prevents code duplication across login, refresh, and logout functions.
 * @returns {Object} Cookie options object
 */
const getBaseCookieOptions = () => ({
    secure: IS_SECURE,
    sameSite: 'lax', // Protects against CSRF on top-level navigations
    path: '/'
});

// ==== Core Authentication Logic ====

/**
 * LOGIN: Authenticates a user and sets up the 3-Token Architecture.
 */
exports.login = async (req, res) => {
    const { email, password, remember } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        const accessToken = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        const refreshToken = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.REFRESH_TOKEN_SECRET,
            { expiresIn: remember ? '7d' : '1d' }
        );

        const csrfToken = crypto.randomBytes(32).toString('hex');
        const baseCookieOptions = getBaseCookieOptions();
        
        if (remember) {
            res.cookie(ACCESS_COOKIE, accessToken, { ...baseCookieOptions, httpOnly: true, maxAge: ACCESS_TTL }); 
            res.cookie(REFRESH_COOKIE, refreshToken, { ...baseCookieOptions, httpOnly: true, maxAge: REFRESH_TTL_REMEMBER });
            res.cookie(CSRF_COOKIE, csrfToken, { ...baseCookieOptions, httpOnly: false, maxAge: REFRESH_TTL_REMEMBER });
        } else {
            res.cookie(ACCESS_COOKIE, accessToken, { ...baseCookieOptions, httpOnly: true }); 
            res.cookie(REFRESH_COOKIE, refreshToken, { ...baseCookieOptions, httpOnly: true });
            res.cookie(CSRF_COOKIE, csrfToken, { ...baseCookieOptions, httpOnly: false });
        }

        return res.status(200).json({
            message: 'Login successful',
            csrfToken 
        });
    } catch (err) {
        console.error('Login Error:', err);
        return res.status(500).json({ message: 'Server error', error: err });
    }
};

/**
 * REGISTER: Validates new user input, checks email validity, generates an OTP, and sends it.
 */
exports.register = async (req, res) => {
    const { fullname, email, password } = req.body;

    // LỚP PHÒNG NGỰ 1: Kiểm tra tính hợp lệ của Domain Email (MX Record)
    if (!emailValidator.validate(email)) {
        return res.status(400).json({ message: 'Invalid email address or domain does not exist.' });
    }

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email is already registered. Please login.' });
        }

        // Hash the password securely
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Generate OTP
        const otp = generateOTP();
        
        // LỚP PHÒNG NGỰ 2: Gửi thử OTP. Nếu Nodemailer bị từ chối (Bounce), báo lỗi ngay.
        try {
            await saveOtpToDB(email, otp); 
            await sendEmailOtp(email, otp, 'register');
        } catch (mailError) {
            console.error('[AuthController] Mail Delivery Failed:', mailError);
            return res.status(400).json({ message: 'Could not deliver OTP. Please ensure this email actually exists and can receive messages.' });
        }

        // Chỉ lưu vào bộ nhớ tạm KHI VÀ CHỈ KHI email đã được gửi thành công
        tempUserStore[email] = {
            fullname,
            email,
            password: hashedPassword,
            otp
        };

        setTimeout(() => {
            if (tempUserStore[email]) {
                delete tempUserStore[email];
                console.log(`[Auth] Xóa data đăng ký tạm của ${email} do quá hạn OTP.`);
            }
        }, 15 * 60 * 1000);

        res.status(200).json({ message: 'OTP has been sent. Please verify to complete registration.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

/**
 * VERIFY OTP: Matches the provided OTP against the stored one.
 */
exports.verify = async (req, res) => {
    const { email, otp } = req.body;
    const userData = tempUserStore[email];

    if (!userData) {
        return res.status(400).json({ message: 'No pending registration found for this email. It may have expired.' });
    }
    if (userData.otp !== otp) {
        return res.status(400).json({ message: 'Invalid OTP code.' });
    }

    try {
        const newUser = new User({
            fullname: userData.fullname,
            email: userData.email,
            password: userData.password
        });

        await newUser.save();
        delete tempUserStore[email];

        return res.status(200).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Verify error:', error);
        return res.status(500).json({ message: 'Server error during verification' });
    }
};

/**
 * REFRESH TOKEN: Issues a new access token without requiring re-login.
 */
exports.refreshToken = async (req, res) => {
    const incomingRefreshToken = req.cookies[REFRESH_COOKIE];
    const baseOptions = getBaseCookieOptions();

    if (!incomingRefreshToken) {
        res.clearCookie(ACCESS_COOKIE, { ...baseOptions, httpOnly: true });
        res.clearCookie(REFRESH_COOKIE, { ...baseOptions, httpOnly: true });
        res.clearCookie(CSRF_COOKIE, baseOptions);
        return res.status(401).json({ message: 'Refresh token missing' });
    }

    try {
        const payload = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
        
        const newAccessToken = jwt.sign(
            { userId: payload.userId, role: payload.role },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        res.cookie(ACCESS_COOKIE, newAccessToken, { 
            ...baseOptions, httpOnly: true, maxAge: ACCESS_TTL 
        });

        return res.status(200).json({ message: 'Token refreshed successfully' });
    } catch (error) {
        res.clearCookie(ACCESS_COOKIE, { ...baseOptions, httpOnly: true });
        res.clearCookie(REFRESH_COOKIE, { ...baseOptions, httpOnly: true });
        res.clearCookie(CSRF_COOKIE, baseOptions);
        return res.status(403).json({ message: 'Refresh token invalid or expired. Please login again.' });
    }
};

/**
 * LOGOUT: Terminates the user session.
 */
exports.logout = (req, res) => {
    const baseOptions = getBaseCookieOptions();
    
    res.clearCookie(ACCESS_COOKIE, { ...baseOptions, httpOnly: true });
    res.clearCookie(REFRESH_COOKIE, { ...baseOptions, httpOnly: true });
    res.clearCookie(CSRF_COOKIE, baseOptions); 
    
    return res.status(200).json({ message: 'Logged out successfully' });
};

/**
 * SEND FORGOT PASSWORD OTP
 */
exports.sendForgotPasswordOtp = async (req, res) => {
    const { email } = req.body;

    try {
        const otp = generateOTP();
        
        try {
            await saveOtpToDB(email, otp);
            await sendEmailOtp(email, otp, 'forgot');
        } catch (mailError) {
            return res.status(400).json({ message: 'Could not deliver OTP. Ensure the email address is correct.' });
        }
        
        res.status(200).json({ message: 'OTP sent successfully' });
    } catch (error) {
        console.error('Error sending OTP:', error);
        res.status(500).json({ message: 'Failed to send OTP', error });
    }
};

/**
 * RESET PASSWORD
 */
exports.resetPassword = async (req, res) => {
    const { email, otp, newPassword } = req.body;

    try {
        const record = await Otp.findOne({ email });
        if (!record || record.otp !== otp) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        const hashed = await bcrypt.hash(newPassword, 10);
        await User.findOneAndUpdate({ email }, { password: hashed });
        await Otp.deleteOne({ email });

        res.status(200).json({ message: 'Password reset successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error during reset', error: err });
    }
};