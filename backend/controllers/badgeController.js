const Badge = require('../models/Badge');
const User = require('../models/User');

/**
 * * GET /api/badges/my-badges
 * Fetch the entire list of system badges and mark those the User has earned.
 */
exports.getMyBadges = async (req, res) => {
    try {
        const userId = req.userId;

        // Get user info along with the list of earned badges
        const user = await User.findById(userId).lean();
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Create a Map/Dictionary for quick lookup of badges the user already has
        const earnedBadgeMap = {};
        if (user.earnedBadges && user.earnedBadges.length > 0) {
            user.earnedBadges.forEach(eb => {
                earnedBadgeMap[eb.badgeId.toString()] = eb.earnedAt;
            });
        }

        // Fetch ALL badges currently in the system
        const allBadges = await Badge.find({}).lean();

        // Combine data (Map)
        const badgeCase = allBadges.map(badge => {
            const earnedAt = earnedBadgeMap[badge._id.toString()];
            return {
                _id: badge._id,
                name: badge.name,
                description: badge.description,
                iconUrl: badge.iconUrl,
                category: badge.category,
                isEarned: !!earnedAt, // Return true if earned
                earnedAt: earnedAt || null
            };
        });

        // Sort: Earned badges first, unearned last
        badgeCase.sort((a, b) => (b.isEarned === a.isEarned) ? 0 : b.isEarned ? 1 : -1);

        // Return alongside current accuracy Streak info for the Frontend to build a Progress Bar
        return res.status(200).json({
            streaks: user.streaks || {},
            badges: badgeCase
        });

    } catch (error) {
        console.error('Error fetching badges:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};