const bcrypt = require('bcryptjs');
const User = require('../models/User');
const cloudinary = require('../cloudinaryConfig');

// GET /api/users/me  -> lấy hồ sơ (ẩn password)
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (err) {
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
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'avatars', // You can specify the folder name
        });

        const avatarUrl = result.secure_url;

        const user = await User.findByIdAndUpdate(
            req.userId,
            { $set: { avatarUrl } },
            { new: true }
        ).select('-password');

        res.json({ message: 'Avatar updated', avatarUrl: user.avatarUrl });
    } catch (e) {
        res.status(500).json({ message: 'Upload failed', error: e.message });
    }
};

// PUT /api/users/me/banner  (form-data field: banner)
exports.updateBanner = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'banners', // You can specify the folder name
        });

        const bannerUrl = result.secure_url;

        const user = await User.findByIdAndUpdate(
            req.userId,
            { $set: { bannerUrl } },
            { new: true }
        ).select('-password');

        res.json({ message: 'Banner updated', bannerUrl: user.bannerUrl });
    } catch (e) {
        res.status(500).json({ message: 'Upload failed', error: e.message });
    }
};
