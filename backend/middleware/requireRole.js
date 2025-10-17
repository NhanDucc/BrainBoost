const User = require('../models/User');

module.exports = (role) => async (req, res, next) => {
    try {
        // auth middleware must set req.userId beforehand (already available)
        const user = await User.findById(req.userId).select('role');
        if (!user) return res.status(401).json({ message: 'Unauthorized' });
        if (user.role !== role) return res.status(403).json({ message: 'Forbidden' });
        req.userRole = user.role;
        next();
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};
