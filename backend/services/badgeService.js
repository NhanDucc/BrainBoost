const EventEmitter = require('events');
const User = require('../models/User');
const Badge = require('../models/Badge');
const Notification = require('../models/Notification');
const TestResult = require('../models/TestResult');

// Initialize a global event emitter
const badgeEvents = new EventEmitter();

/**
 * Listen to BATCH event: WHEN USER SUBMITS ENTIRE TEST
 * Process the entire answers array in RAM to avoid VersionError and Database bottlenecks
 */
badgeEvents.on('answers_batch_submitted', async ({ userId, subject, answers }) => {
    try {
        const user = await User.findById(userId);
        if (!user || !subject) return;

        const sKey = subject.toLowerCase();

        for (const ans of answers) {
            let qType = (ans.type || "mcq").toLowerCase();
            if (qType === 'boolean') qType = 'tf';

            // Check if the subject and question type container exists
            if (user.streaks[sKey] && user.streaks[sKey][qType]) {
                const target = user.streaks[sKey][qType];
                
                if (ans.isCorrect) {
                    target.current += 1;
                    // Update highest record if surpassed
                    if (target.current > target.highest) {
                        target.highest = target.current;
                    }
                } else {
                    target.current = 0; // 1 wrong answer immediately resets the streak for that subject
                }
            }
        }

        // Find matching badges based on subject and qType
        const earnedBadgeIds = user.earnedBadges.map(b => b.badgeId.toString());
        const potentialBadges = await Badge.find({
            _id: { $nin: earnedBadgeIds },
            subject: sKey // Only consider badges for this subject
        });

        const newEarnedBadges = [];
        for (const badge of potentialBadges) {
            const bType = badge.criteria.questionType.toLowerCase();
            // Use HIGHEST to compare with targetCount (20, 50, 120...)
            if (user.streaks[sKey][bType] && user.streaks[sKey][bType].highest >= badge.criteria.targetCount) {
                user.earnedBadges.push({ badgeId: badge._id });
                newEarnedBadges.push(badge);
            }
        }

        await user.save();

        // Emit notification (fixed userId -> user to match Schema)
        for (const badge of newEarnedBadges) {
            await Notification.create({
                user: user._id,
                type: 'system',
                title: `New Rank: ${badge.name}`,
                message: `Awesome! You have achieved the ${badge.rank} rank in ${subject.toUpperCase()}!`,
                link: '/profile'
            });
        }
    } catch (error) {
        console.error('Error calculating rank:', error);
    }
});

badgeEvents.on('test_completed', async ({ userId, testId, percent }) => {
    try {
        // Only consider the Comeback badge if they score a perfect 100% this time
        if (percent !== 100) return;

        const user = await User.findById(userId);
        if (!user) return;

        // Find the "The Comeback Kid" badge in DB (assuming category is SPECIAL)
        const comebackBadge = await Badge.findOne({ category: 'SPECIAL', name: 'The Comeback Kid' });
        if (!comebackBadge) return;

        // Check if the user already has this badge (avoid awarding twice)
        const hasBadge = user.earnedBadges.some(b => b.badgeId.toString() === comebackBadge._id.toString());
        if (hasBadge) return;

        // Fetch the entire history of THIS test for the user, sorted oldest to newest
        const previousAttempts = await TestResult.find({ student: userId, test: testId })
            .sort({ completedAt: 1 })
            .lean();
        
        // CHECK "COMEBACK" CONDITIONS:
        // If in previous attempts, there was at least 1 score below failing grade (e.g., < 40%)
        // Note: pop() ignores the 100% result just saved
        previousAttempts.pop(); 
        const hadFailed = previousAttempts.some(attempt => attempt.finalPercent < 40);

        if (hadFailed) {
            // Conditions met to award badge!
            user.earnedBadges.push({ badgeId: comebackBadge._id });
            await user.save();

            // Send notification
            await Notification.create({
                user: user._id,
                title: 'New Badge: The Comeback Kid!',
                message: `Incredible! You just made a spectacular comeback with a perfect 100% score on a test you previously failed.`,
                type: 'system',
                link: '/profile'
            });
            console.log(`User ${userId} earned the Comeback Kid badge!`);
        }

    } catch (error) {
        console.error('Error calculating Comeback badge:', error);
    }
});

module.exports = {
    badgeEvents
};