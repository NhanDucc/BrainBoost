const bcrypt = require('bcryptjs');
const User = require('../models/User');
const TestResult = require('../models/TestResult');
const LessonProgress = require('../models/LessonProgress');

// ==== Helper function ====
// Formats a date object to a standard YYYY-MM-DD string adjusted to the local timezone to prevent UTC date shifting errors
const toISODate = (date) => {
    const d = new Date(date);
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
};

// Normalizes raw subject names from the database to ensure they match the exact labels expected by the Frontend UI
const mapSubject = (rawSubject) => {
    const s = String(rawSubject || '').trim().toLowerCase();
    if (s.includes('math')) return 'Mathematics';
    if (s.includes('phys')) return 'Physics';
    if (s.includes('chem')) return 'Chemistry';
    if (s.includes('eng')) return 'English';
    return rawSubject; // Return as-is if no exact match is found
};

/**
 * Retrieves the currently authenticated user's profile, including dynamic learning statistics like study calendar, weekly progress, and practice history.
 * * GET /api/users/me
 */
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password').lean();
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Populate test details (title, subject, grade) and sort by newest first
        const testResults = await TestResult.find({ student: req.userId })
            .populate('test', 'title subject grade')
            .sort({ completedAt: -1 }); 
            
        const lessonProgresses = await LessonProgress.find({ user: req.userId });

        // Use a Set to store unique dates where the user was active
        const submittedDaysSet = new Set();

        // Calculate active study days
        testResults.forEach(tr => {
            if (tr.completedAt) submittedDaysSet.add(toISODate(tr.completedAt));
        });
        
        lessonProgresses.forEach(lp => {
            if (lp.lastAccessed) submittedDaysSet.add(toISODate(lp.lastAccessed));
        });

        // Calculate weekly statistics
        const weekStats = [];
        const displayDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

        const today = new Date();
        const dayOfWeek = today.getDay(); 
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; 
        const monday = new Date(today);
        monday.setDate(today.getDate() + diffToMonday);
        monday.setHours(0, 0, 0, 0);

        for (let i = 0; i < 7; i++) {
            const currentDay = new Date(monday);
            currentDay.setDate(monday.getDate() + i);
            const dateStr = toISODate(currentDay);

            let stats = { day: displayDays[i], Mathematics: 0, Physics: 0, Chemistry: 0, English: 0, minutes: 0 };

            // Count the number of Tests completed on this specific day
            testResults.forEach(tr => {
                if (tr.completedAt && toISODate(tr.completedAt) === dateStr) {
                    const subj = mapSubject(tr.test?.subject);
                    if (stats[subj] !== undefined) {
                        stats[subj] += 1; 
                    }
                    stats.minutes += tr.timeSpent || 0; 
                }
            });

            // Count the number of Lessons accessed on this specific day
            lessonProgresses.forEach(lp => {
                if (lp.lastAccessed && toISODate(lp.lastAccessed) === dateStr) {
                    const subj = mapSubject(lp.subject);
                    if (stats[subj] !== undefined) {
                        stats[subj] += 1;
                    }
                    stats.minutes += lp.timeSpent || 20; 
                }
            });

            weekStats.push(stats);
        }

        // Format the user's test history array to be consumed by the frontend Profile UI
        const practiceHistory = testResults.map(tr => ({
            id: tr._id,
            testId: tr.test?._id,
            title: tr.test?.title || "Unknown Test",
            subject: mapSubject(tr.test?.subject),
            score: tr.totalScore,
            maxScore: tr.maxScore,
            percent: tr.finalPercent,
            timeSpent: tr.timeSpent,
            completedAt: tr.completedAt
        }));

        // Attach computed stats to the user object
        user.study = {
            submittedDays: Array.from(submittedDaysSet)
        };
        user.weekStats = weekStats;
        user.practiceHistory = practiceHistory;

        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

/**
 * Updates basic user profile information. 
 * Note: Email updates are restricted in this endpoint for security reasons.
 * * PUT /api/users/me
 */
exports.updateMe = async (req, res) => {
    try {
        const { fullname, phone, address, dateOfBirth, bio } = req.body;

        const update = { fullname, phone, address, bio };
        if (dateOfBirth) {
            const d = new Date(dateOfBirth);
            if (!isNaN(d)) update.dateOfBirth = d;
        }

        const user = await User.findByIdAndUpdate(
            req.userId,
            { $set: update, $currentDate: { updatedAt: true } },
            { new: true, runValidators: true }
        ).select('-password');

        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Update failed', error: err.message });
    }
};

/**
 * Changes the user's password. Requires verifying the current password first.
 * * PUT /api/users/me/password
 */
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword)
        return res.status(400).json({ message: 'Missing current/new password' });

        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Verify the old password
        const ok = await bcrypt.compare(currentPassword, user.password);
        if (!ok) return res.status(400).json({ message: 'Current password is incorrect' });

        // Hash and save the new password
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.json({ message: 'Password updated' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

/**
 * Updates the user's profile avatar. 
 * Expects the middleware to handle the file upload and attach the URL to `req.fileUrl`.
 * * PUT /api/users/me/avatar (form-data field: avatar)
 */
exports.updateAvatar = async (req, res) => {
    try {
        if (!req.fileUrl) return res.status(400).json({ message: 'No file uploaded' });

        const user = await User.findByIdAndUpdate(
        req.userId,
        { $set: { avatarUrl: req.fileUrl } },
        { new: true }
        ).select('-password');

        res.json({ message: 'Avatar updated', avatarUrl: user.avatarUrl, updatedAt: user.updatedAt });
    } catch (e) {
        res.status(500).json({ message: 'Upload failed', error: e.message });
    }
};

/**
 * Updates the user's profile banner.
 * Expects the middleware to handle the file upload and attach the URL to `req.fileUrl`.
 * * PUT /api/users/me/banner (form-data field: banner)
 */
exports.updateBanner = async (req, res) => {
    try {
        if (!req.fileUrl) return res.status(400).json({ message: 'No file uploaded' });

        const user = await User.findByIdAndUpdate(
        req.userId,
        { $set: { bannerUrl: req.fileUrl } },
        { new: true }
        ).select('-password');

        res.json({ message: 'Banner updated', bannerUrl: user.bannerUrl, updatedAt: user.updatedAt });
    } catch (e) {
        res.status(500).json({ message: 'Upload failed', error: e.message });
    }
};

// Cập nhật các thiết lập hệ thống (Settings) của User
exports.updatePreferences = async (req, res) => {
    try {
        const { isAnonymous } = req.body;
        const User = require('../models/User');

        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Cập nhật preference
        if (!user.preferences) user.preferences = {};
        user.preferences.isAnonymous = isAnonymous;

        await user.save();
        
        // Trả về user đã cập nhật (ẩn mật khẩu)
        const updatedUser = await User.findById(req.userId).select('-password');
        res.json(updatedUser);
    } catch (error) {
        console.error("Update Preferences Error:", error);
        res.status(500).json({ message: 'Failed to update preferences' });
    }
};