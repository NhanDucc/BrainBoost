const router = require('express').Router();
const { auth, authorize } = require('../middleware/auth');
const contactController = require('../controllers/contactController');

// ==== User Routes ====

// Handle the submission of a new contact/support form by an authenticated user
router.post('/', auth, contactController.send);

// ==== Admin Management Routes ====

// Retrieve a list of all unread contact messages for the admin dashboard
router.get('/unread', auth, authorize('admin'), contactController.getUnreadMessages);
// Mark a specific contact message as read/resolved using its ID
router.put('/:id/read', auth, authorize('admin'), contactController.markAsRead);

module.exports = router;