const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Otp = require('../models/Otp');
const { sendEmailOtp } = require('../middleware/sendEmailOtp');
const { saveOtpToDB } = require('../middleware/otpHelper');

const tempUserStore = {}; // Temporary storage for user data during OTP verification
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString(); // Generate a 6-digit OTP

// === Cookie/TTL constants ===
const COOKIE_NAME = 'bb_jwt';
const HOUR = 60 * 60 * 1000;
const WEEK = 7 * 24 * 60 * 60 * 1000;
const COOKIE_SECURE = process.env.NODE_ENV === 'production';

// Register a new user
exports.register = async (req, res) => {
    const { fullname, email, password } = req.body;

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const otp = generateOTP();
        await saveOtpToDB(email, otp); // Save OTP to database with expiration
        await sendEmailOtp(email, otp, 'register');

        // Store user temporarily for OTP verification
        tempUserStore[email] = {
            fullname,
            email,
            password: hashedPassword,
            otp
        };

        res.status(200).json({ message: 'OTP has been sent. Please verify to complete registration.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error });
    }
};

// Verify OTP
exports.verify = async (req, res) => {
    const { email, otp } = req.body;
    const userData = tempUserStore[email];

    if (!userData) {
        return res.status(400).json({ message: 'No pending registration' });
    }
    if (userData.otp !== otp) {
        return res.status(400).json({ message: 'Invalid OTP' });
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

// Login a user
exports.login = async (req, res) => {
    const { email, password, remember } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Invalid credentials' });

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return res.status(400).json({ message: 'Invalid credentials' });

        const expiresIn = remember ? '7d' : '1h';
        const maxAge = remember ? WEEK : HOUR;

        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn }
        );

        res.cookie(COOKIE_NAME, token, {
            httpOnly: true,
            secure: COOKIE_SECURE,
            sameSite: 'lax',
            path: '/',
            maxAge: maxAge
        });

        return res.status(200).json({
        message: 'Login successful',
        // user: {
        //     id: user._id,
        //     fullname: user.fullname,
        //     email: user.email,
        //     role: user.role,
        //     avatarUrl: user.avatarUrl,
        //     bannerUrl: user.bannerUrl,
        // },
        });
    } catch (err) {
        console.error('login error:', err);
        return res.status(500).json({ message: 'Server error', error: err });
    }
};

// Logout
exports.logout = (req, res) => {
    res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        secure: COOKIE_SECURE,
        sameSite: 'lax',
        path: '/'
    });
    res.cookie(COOKIE_NAME, '', { httpOnly:true, secure:COOKIE_SECURE, sameSite:'lax', path:'/', expires: new Date(0) });
    return res.json({ message: 'Logged out '});
};

// Send OTP for password reset
exports.sendForgotPasswordOtp = async (req, res) => {
    const { email } = req.body;

    try {
        const otp = generateOTP();
        await saveOtpToDB(email, otp);
        await sendEmailOtp(email, otp, 'forgot');
        res.status(200).json({ message: 'OTP sent successfully' });
    } catch (error) {
        console.error('Error sending OTP:', error);
        res.status(500).json({ message: 'Failed to send OTP', error });
    }
};

// Reset Password
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