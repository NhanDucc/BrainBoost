const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
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
 * 1. Short-lived Access Token (15m) for API authorization.
 * 2. Long-lived Refresh Token (1d/7d) to get new access tokens silently.
 * 3. CSRF Token to prevent Cross-Site Request Forgery attacks.
 */
exports.login = async (req, res) => {
    const { email, password, remember } = req.body;

    try {
        // Validate credentials
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        // Generate Short-lived Access Token
        const accessToken = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        // Generate Long-lived Refresh Token based on 'Remember Me' preference
        const refreshToken = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.REFRESH_TOKEN_SECRET,
            { expiresIn: remember ? '7d' : '1d' }
        );

        // Generate random CSRF Token
        const csrfToken = crypto.randomBytes(32).toString('hex');

        // Retrieve base cookie settings
        const baseCookieOptions = getBaseCookieOptions();
        
        if (remember) {
            // Persistent Cookies: Will survive browser restarts
            res.cookie(ACCESS_COOKIE, accessToken, { ...baseCookieOptions, httpOnly: true, maxAge: ACCESS_TTL }); 
            res.cookie(REFRESH_COOKIE, refreshToken, { ...baseCookieOptions, httpOnly: true, maxAge: REFRESH_TTL_REMEMBER });
            // CSRF cookie MUST NOT be httpOnly so the frontend JS can read it
            res.cookie(CSRF_COOKIE, csrfToken, { ...baseCookieOptions, httpOnly: false, maxAge: REFRESH_TTL_REMEMBER });
        } else {
            // Session Cookies: Omitting 'maxAge' forces the browser to delete them when closed
            res.cookie(ACCESS_COOKIE, accessToken, { ...baseCookieOptions, httpOnly: true }); 
            res.cookie(REFRESH_COOKIE, refreshToken, { ...baseCookieOptions, httpOnly: true });
            res.cookie(CSRF_COOKIE, csrfToken, { ...baseCookieOptions, httpOnly: false });
        }

        return res.status(200).json({
            message: 'Login successful',
            csrfToken // Send to frontend for initial setup (optional, as frontend can read the cookie)
        });
    } catch (err) {
        console.error('Login Error:', err);
        return res.status(500).json({ message: 'Server error', error: err });
    }
};

/**
 * REGISTER: Validates new user input, generates an OTP, and sends it via email.
 * Holds the user's data in temporary memory until the email is verified.
 */
exports.register = async (req, res) => {
    const { fullname, email, password } = req.body;

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash the password securely
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Generate and dispatch OTP
        const otp = generateOTP();
        await saveOtpToDB(email, otp); 
        await sendEmailOtp(email, otp, 'register');

        // Temporarily store user data pending email verification
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

/**
 * VERIFY OTP: Matches the provided OTP against the stored one.
 * Upon success, migrates the temporary user data into the main MongoDB database.
 */
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
        // Move data from RAM to Persistent DB
        const newUser = new User({
            fullname: userData.fullname,
            email: userData.email,
            password: userData.password
        });

        await newUser.save();
        
        // Free up memory and prevent double registration
        delete tempUserStore[email];

        return res.status(200).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Verify error:', error);
        return res.status(500).json({ message: 'Server error during verification' });
    }
};

/**
 * REFRESH TOKEN: Automatically requested by the frontend when the Access Token expires.
 * Validates the refresh token and issues a new access token without requiring re-login.
 */
exports.refreshToken = async (req, res) => {
    const incomingRefreshToken = req.cookies[REFRESH_COOKIE];
    const baseOptions = getBaseCookieOptions();

    // Loop breaker: If no refresh token exists, immediately destroy all other tokens
    if (!incomingRefreshToken) {
        res.clearCookie(ACCESS_COOKIE, { ...baseOptions, httpOnly: true });
        res.clearCookie(REFRESH_COOKIE, { ...baseOptions, httpOnly: true });
        res.clearCookie(CSRF_COOKIE, baseOptions);
        return res.status(401).json({ message: 'Refresh token missing' });
    }

    try {
        // Verify the validity of the refresh token
        const payload = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
        
        // Issue a fresh Access Token
        const newAccessToken = jwt.sign(
            { userId: payload.userId, role: payload.role },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        // Send the new Access Token to the client via httpOnly cookie
        res.cookie(ACCESS_COOKIE, newAccessToken, { 
            ...baseOptions, httpOnly: true, maxAge: ACCESS_TTL 
        });

        return res.status(200).json({ message: 'Token refreshed successfully' });
    } catch (error) {
        // Token is manipulated or expired: Clean up everything and force re-login
        res.clearCookie(ACCESS_COOKIE, { ...baseOptions, httpOnly: true });
        res.clearCookie(REFRESH_COOKIE, { ...baseOptions, httpOnly: true });
        res.clearCookie(CSRF_COOKIE, baseOptions);
        return res.status(403).json({ message: 'Refresh token invalid or expired. Please login again.' });
    }
};

/**
 * LOGOUT: Terminates the user session by actively deleting all authentication cookies.
 */
exports.logout = (req, res) => {
    const baseOptions = getBaseCookieOptions();
    
    // Use Express clearCookie to safely remove tokens
    res.clearCookie(ACCESS_COOKIE, { ...baseOptions, httpOnly: true });
    res.clearCookie(REFRESH_COOKIE, { ...baseOptions, httpOnly: true });
    res.clearCookie(CSRF_COOKIE, baseOptions); 
    
    return res.status(200).json({ message: 'Logged out successfully' });
};

/**
 * SEND FORGOT PASSWORD OTP: Generates an OTP for an existing user attempting 
 * to recover their account and emails it to them.
 */
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

/**
 * RESET PASSWORD: Verifies the recovery OTP and updates the user's password record.
 */
exports.resetPassword = async (req, res) => {
    const { email, otp, newPassword } = req.body;

    try {
        // Find the valid OTP record in the DB
        const record = await Otp.findOne({ email });
        if (!record || record.otp !== otp) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        // Hash new password and update user
        const hashed = await bcrypt.hash(newPassword, 10);
        await User.findOneAndUpdate({ email }, { password: hashed });
        
        // Clean up the used OTP record
        await Otp.deleteOne({ email });

        res.status(200).json({ message: 'Password reset successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Server error during reset', error: err });
    }
};