const bcrypt = require('bcryptjs');
const User = require('../models/User');
const TestResult = require('../models/TestResult');
const LessonProgress = require('../models/LessonProgress');

// Hàm phụ trợ: Ép định dạng ngày chuẩn múi giờ địa phương (YYYY-MM-DD)
const toISODate = (date) => {
    const d = new Date(date);
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
};

// Hàm chuẩn hóa tên môn học từ DB sang Frontend
const mapSubject = (rawSubject) => {
    const s = String(rawSubject || '').trim().toLowerCase();
    if (s.includes('math')) return 'Mathematics';
    if (s.includes('phys')) return 'Physics';
    if (s.includes('chem')) return 'Chemistry';
    if (s.includes('eng')) return 'English';
    return rawSubject; // Nếu không khớp thì giữ nguyên
};

// GET /api/users/me  -> Lấy hồ sơ (kèm thống kê động)
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password').lean();
        if (!user) return res.status(404).json({ message: 'User not found' });

        const testResults = await TestResult.find({ student: req.userId }).populate('test', 'subject');
        const lessonProgresses = await LessonProgress.find({ user: req.userId });

        // Dùng Set để lọc các ngày trùng nhau
        const submittedDaysSet = new Set();

        // 1. TÍNH CÁC NGÀY ĐÃ HỌC (ĐỂ TÔ CHẤM XANH TRÊN LỊCH)
        testResults.forEach(tr => {
            if (tr.completedAt) submittedDaysSet.add(toISODate(tr.completedAt));
        });
        
        lessonProgresses.forEach(lp => {
            if (lp.lastAccessed) submittedDaysSet.add(toISODate(lp.lastAccessed));
        });

        // 2. TÍNH TOÁN BẢNG THỐNG KÊ TUẦN (Từ Thứ 2 đến Chủ nhật tuần này)
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

            // Tính số bài Test trong ngày
            testResults.forEach(tr => {
                if (tr.completedAt && toISODate(tr.completedAt) === dateStr) {
                    const subj = mapSubject(tr.test?.subject);
                    if (stats[subj] !== undefined) {
                        stats[subj] += 1; 
                    }
                    stats.minutes += tr.timeSpent || 0; // Lấy timeSpent thực tế (lưu ở DB)
                }
            });

            // Tính số bài giảng (Lesson) trong ngày
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

        user.study = {
            submittedDays: Array.from(submittedDaysSet)
        };
        user.weekStats = weekStats;

        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// PUT /api/users/me  -> cập nhật thông tin cơ bản (không cho đổi email ở đây)
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

// PUT /api/users/me/password  -> đổi mật khẩu
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword)
        return res.status(400).json({ message: 'Missing current/new password' });

        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const ok = await bcrypt.compare(currentPassword, user.password);
        if (!ok) return res.status(400).json({ message: 'Current password is incorrect' });

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.json({ message: 'Password updated' });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// PUT /api/users/me/avatar  (form-data field: avatar)
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

// PUT /api/users/me/banner  (form-data field: banner)
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
