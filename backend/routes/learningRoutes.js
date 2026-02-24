const express = require('express');
const router = express.Router();
const learningController = require('../controllers/learningController');
const { auth } = require('../middleware/auth');

// Retrieves the user's "Mistakes Notebook"
router.get('/mistakes', auth, learningController.getMistakesNotebook);

// Toggles a test in the user's bookmarks
router.post('/bookmarks/toggle', auth, learningController.toggleBookmark);

// Retrieves a formatted list of all tests the user has saved for later
router.get('/bookmarks', auth, learningController.getBookmarkedTests);

// Saves a new AI-generated learning path to the user's profile
router.post('/paths', auth, learningController.saveLearningPath);

// Retrieves all personalized AI learning paths the user has previously saved
router.get('/paths', auth, learningController.getSavedPaths);

module.exports = router;