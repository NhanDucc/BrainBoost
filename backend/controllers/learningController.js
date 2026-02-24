const TestResult = require('../models/TestResult');
const Test = require('../models/Test');
const User = require('../models/User');

/**
 * Retrieves the user's incorrect answers across all completed tests 
 * to generate a "Mistakes Notebook" for review.
 * * GET /api/learning/mistakes
 */
exports.getMistakesNotebook = async (req, res) => {
    try {
        // Find all test submissions for the current authenticated user
        const results = await TestResult.find({ student: req.userId })
            .populate('test', 'title subject questions')
            .sort({ completedAt: -1 })
            .lean();

        let mistakes = [];

        // Iterate through the results to filter out incorrect answers and map them with the original question data
        results.forEach(result => {
            if (!result.test) return; // Skip if the original test has been deleted from the database

            const testQuestions = result.test.questions || [];

            result.answers.forEach(ans => {
                // Only process questions that the system marked as strictly incorrect
                if (ans.isCorrect === false) {
                
                let qInfo = null;
                // Map the string questionId (e.g., "q1", "q2") back to the array index (0, 1)
                if (ans.questionId && ans.questionId.startsWith('q')) {
                    const idx = parseInt(ans.questionId.replace('q', '')) - 1;
                    qInfo = testQuestions[idx];
                }

                if (qInfo) {
                    // Determine the correct answer index based on the question type
                    let correctAnsIndex = null;
                    if (qInfo.type === 'mcq') correctAnsIndex = qInfo.correctIndex;
                    else if (qInfo.type === 'boolean') correctAnsIndex = qInfo.correctBool ? 0 : 1; 

                    // Push the structured mistake object to the array
                    mistakes.push({
                        id: `${result._id}-${ans.questionId}`,  // Generate a unique composite ID for React keys
                        testId: result.test._id,
                        testTitle: result.test.title,
                        subject: result.test.subject,
                        completedAt: result.completedAt,
                        type: ans.type,
                        stem: qInfo.stem,
                        choices: qInfo.choices || ["True", "False"],    // Auto-supply choices for boolean types
                        studentAnswer: ans.studentAnswer,   // The option index the student incorrectly chose
                        correctAnswer: correctAnsIndex, // The actual correct option index
                        explanation: qInfo.explanation || "No explanation provided."
                    });
                }
                }
            });
        });

        res.json(mistakes);
    } catch (error) {
        console.error("Get Mistakes Error:", error);
        res.status(500).json({ message: "Failed to fetch mistakes" });
    }
};

/**
 * Toggles the bookmark status of a specific test for the user.
 * If the test is already saved, it removes it. If not, it adds it.
 *  * POST /api/learning/bookmarks/toggle
 */
exports.toggleBookmark = async (req, res) => {
    try {
        const { testId } = req.body;

        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Check if the test is currently in the user's bookmarks array
        const isBookmarked = user.bookmarkedTests.includes(testId);

        if (isBookmarked) {
            // If already bookmarked -> Remove it (Unsave)
            user.bookmarkedTests.pull(testId);
        } else {
            // If not bookmarked -> Add it (Save)
            user.bookmarkedTests.push(testId);
        }

        await user.save();
        res.json({ isBookmarked: !isBookmarked, message: !isBookmarked ? "Saved to bookmarks" : "Removed from bookmarks" });
    } catch (error) {
        console.error("Toggle Bookmark Error:", error);
        res.status(500).json({ message: "Failed to toggle bookmark" });
    }
};

/**
 * Retrieves the list of tests the user has bookmarked.
 * Formats the data to be easily consumed by the frontend test grid.
 * * GET /api/learning/bookmarks
 */
exports.getBookmarkedTests = async (req, res) => {
    try {
        // Find the user and populate the 'bookmarkedTests' array to fetch the actual Test documents
        const user = await User.findById(req.userId).populate({
            path: 'bookmarkedTests',
            select: '_id title subject grade difficulty numQuestions description tags' 
        }).lean();

        if (!user) return res.status(404).json({ message: "User not found" });

        // Format the bookmarked data to match the UI structure used in the "AllTests" screen
        const formattedBookmarks = (user.bookmarkedTests || []).map(t => {
            // Extract the main difficulty tag and separate out any custom tags
            const DIFFS = ["Easy", "Medium", "Hard", "Beginner", "Intermediate", "Advanced"];
            const difficulty = (t.tags || []).find(tag => DIFFS.includes(tag)) || "General";
            const customTags = (t.tags || []).filter(tag => !DIFFS.includes(tag));

            return {
                id: t._id,
                title: t.title,
                subjectKey: t.subject,
                subject: t.subject, 
                grade: t.grade,
                questions: t.numQuestions || 0,
                difficulty: difficulty,
                customTags: customTags,
                description: t.description || ""
            };
        });

        res.json(formattedBookmarks);
    } catch (error) {
        console.error("Get Bookmarks Error:", error);
        res.status(500).json({ message: "Failed to fetch bookmarks" });
    }
};

/**
 * Saves a personalized learning path generated by the AI Advisor to the user's profile.
 * * POST /api/learning/paths
 */
exports.saveLearningPath = async (req, res) => {
    try {
        const { goal, advice, path } = req.body;
        
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Unshift pushes the newest learning path to the beginning of the array
        user.savedLearningPaths.unshift({ goal, advice, path });
        await user.save();

        res.status(201).json({ message: "Learning path saved successfully" });
    } catch (error) {
        console.error("Save Learning Path Error:", error);
        res.status(500).json({ message: "Failed to save learning path" });
    }
};

/**
 * Retrieves all the personalized AI learning paths the user has previously saved.
 * * GET /api/learning/paths
 */
exports.getSavedPaths = async (req, res) => {
    try {
        // Retrieve only the savedLearningPaths field to optimize query performance
        const user = await User.findById(req.userId).select('savedLearningPaths').lean();
        
        if (!user) return res.status(404).json({ message: "User not found" });

        res.json(user.savedLearningPaths || []);
    } catch (error) {
        console.error("Get Learning Paths Error:", error);
        res.status(500).json({ message: "Failed to fetch learning paths" });
    }
};