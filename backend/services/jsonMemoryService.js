const LessonChatSession = require('../models/LessonChatSession');

// Retrieve chat history from the database
exports.getHistory = async (userId, courseId, lessonKey) => {
    try {
        const session = await LessonChatSession.findOne({ 
            userId, 
            courseId, 
            lessonKey 
        });

        // If a session is found, return the history array. Otherwise, return an empty array.
        if (session && Array.isArray(session.history)) {
            return session.history;
        }
        return [];
    } catch (error) {
        console.error("[DB Memory] Error getting history:", error);
        return [];
    }
};

// Save chat history to the database.
exports.saveHistory = async (userId, courseId, lessonKey, newHistory) => {
    try {
        // If found, update; if not found, create a new one.
        await LessonChatSession.findOneAndUpdate(
            { userId, courseId, lessonKey },
            { 
                $set: { 
                    history: newHistory,
                    // Update the time so that TTL (10 days) automatically recalculates from now.
                } 
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
    } catch (error) {
        console.error("[DB Memory] Error saving history:", error);
    }
};