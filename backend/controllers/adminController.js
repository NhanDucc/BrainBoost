const User = require('../models/User');
const Course = require('../models/Course');
const Test = require('../models/Test');
const InstructorApplication = require('../models/InstructorApplication');

exports.getDashboardStats = async (req, res) => {
    try {
        // Calculate System KPIs (Key Performance Indicators)
        const totalUsers = await User.countDocuments({ role: 'student' });
        const totalInstructors = await User.countDocuments({ role: 'instructor' });
        const pendingApps = await InstructorApplication.countDocuments({ status: 'pending' });
        const totalContent = (await Course.countDocuments()) + (await Test.countDocuments());

        // Generate Recent Activity Feed (Aggregate the latest data from multiple collections)
        const recentUsers = await User.find().sort({ createdAt: -1 }).limit(3).select('fullname role createdAt');
        const recentTests = await Test.find().sort({ createdAt: -1 }).limit(3).select('title createdBy createdAt').populate('createdBy', 'fullname');
        
        // Map the retrieved data into a unified Activity array
        let activities = [];

        recentUsers.forEach(u => activities.push({
            id: `u_${u._id}`, type: 'user', date: u.createdAt,
            text: `New ${u.role} registered: ${u.fullname}`
        }));

        recentTests.forEach(t => activities.push({
            id: `t_${t._id}`, type: 'test', date: t.createdAt,
            text: `${t.createdBy?.fullname || 'Someone'} created a new test: "${t.title}"`
        }));

        // Sort all activities chronologically (newest first) and keep only the top 5
        activities.sort((a, b) => new Date(b.date) - new Date(a.date));
        const recentActivity = activities.slice(0, 5);

        res.json({
            kpis: { totalUsers, totalInstructors, pendingApps, totalContent },
            recentActivity
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to load admin stats' });
    }
};

// ==== User Management ====

// Get a list of all users (Supports searching by name/email and filtering by role)
exports.getAllUsers = async (req, res) => {
    try {
        const { role, search } = req.query;
        const query = {};
        
        // Apply role filter if a specific role is selected
        if (role && role !== 'all') query.role = role;

        // Apply search filter (case-insensitive regex on fullname or email)
        if (search) {
            query.$or = [
                { fullname: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        // Fetch users and exclude the password field for security reasons
        const users = await User.find(query).sort({ createdAt: -1 }).select('-password');
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch users' });
    }
};

// Update a specific user's role
exports.updateUserRole = async (req, res) => {
    try {
        const { role } = req.body;

        // Validate the provided role
        if (!['student', 'instructor', 'admin'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role' });
        }
        
        // Safety check: Prevent the admin from demoting themselves to avoid losing access
        if (req.params.id === req.userId && role !== 'admin') {
            return res.status(400).json({ message: 'You cannot demote yourself' });
        }

        const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');
        res.json({ message: 'User role updated successfully', user });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update user role' });
    }
};

// Delete a user from the platform
exports.deleteUser = async (req, res) => {
    try {
        // Safety check: Prevent the admin from deleting their own account
        if (req.params.id === req.userId) {
            return res.status(400).json({ message: 'You cannot delete your own account' });
        }
        
        await User.findByIdAndDelete(req.params.id);
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete user' });
    }
};