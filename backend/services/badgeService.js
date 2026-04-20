const EventEmitter = require('events');
class BadgeEmitter extends EventEmitter {}
const badgeEvents = new BadgeEmitter();

const User = require('../models/User');
const socketService = require('./socketService');

/**
 * Core function to award a badge to a user.
 * Checks if the user already owns the badge; if not, adds it and emits a real-time notification.
 * @param {String} userId - The ID of the user receiving the badge.
 * @param {String} badgeName - The name of the badge to award.
 * @param {String} description - The description of the achievement.
 */
async function awardBadge(userId, badgeName, description) {
    try {
        const user = await User.findById(userId);
        if (!user) return;

        // Ensure the user schema has a 'badges' array initialized
        if (!user.badges) user.badges = [];

        // Award the badge if the user does not already own it
        if (!user.badges.includes(badgeName)) {
            user.badges.push(badgeName);
            await user.save();

            // Emit a real-time notification to the user's client
            await socketService.sendNotification({
                userId: user._id,
                title: `New Badge: ${badgeName}`,
                message: description,
                type: 'badge', 
                link: `/badges` // Link to the user's badge collection page
            });
        }
    } catch (error) {
        console.error("[BadgeService] Error awarding badge:", error);
    }
}

// ==== Test Controller Event Listener ====

/**
 * Event: Fired when a user successfully completes a test.
 * Payload: { userId, subject, percent }
 */
badgeEvents.on('test_completed', async ({ userId, subject, percent }) => {
    // The Perfect Mind (Achieved 100%)
    if (percent === 100) {
        await awardBadge(
            userId, 
            "The Perfect Mind", 
            "Excellent! You achieved a perfect 100% score on a test."
        );
    } 
    // High Achiever (Achieved >= 85%)
    else if (percent >= 85) {
        await awardBadge(
            userId, 
            "High Achiever", 
            "Great performance! You surpassed the 85% score mark."
        );
    }
});

/**
 * Event: Fired to evaluate answer streaks (Accuracy Streak).
 * Payload: { userId, subject, answers }
 */
badgeEvents.on('answers_batch_submitted', async ({ userId, subject, answers }) => {
    if (!answers || answers.length === 0) return;

    // Calculate the maximum streak of consecutive correct answers
    let maxStreak = 0;
    let currentStreak = 0;

    answers.forEach(ans => {
        // Check if the answer is correct or has a positive score
        if (ans.isCorrect || ans.score > 0) {
            currentStreak++;
            if (currentStreak > maxStreak) maxStreak = currentStreak;
        } else {
            currentStreak = 0;
        }
    });

    // 10 correct answers in a row
    if (maxStreak >= 10) {
        await awardBadge(
            userId, 
            "Sharp Shooter", 
            "Incredible! You answered 10 questions correctly in a row without making any mistakes."
        );
    }
    // 5 correct answers in a row
    else if (maxStreak >= 5) {
        await awardBadge(
            userId, 
            "On Fire", 
            "You are on fire! You have a streak of 5 correct answers in a row."
        );
    }
});

module.exports = { badgeEvents };