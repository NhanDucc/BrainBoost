const router = require('express').Router();
const { auth, authorize } = require('../middleware/auth');
const adminInstructor = require('../controllers/adminInstructorController');
const adminController = require('../controllers/adminController');

// ==== Admin Dashboard Routes ====

// Fetch system-wide KPIs and recent activity log for the admin dashboard
router.get('/stats', auth, authorize('admin'), adminController.getDashboardStats);

// ==== Instructor Application Routes ====

// Retrieve a list of users applying to become instructors (can filter by status: pending, approved, rejected)
router.get('/instructors/applications', auth, authorize('admin'), adminInstructor.list);
// Approve an instructor application (Upgrades the user's role to 'instructor' and sends an email)
router.post('/instructors/applications/:id/approve', auth, authorize('admin'), adminInstructor.approve);
// Reject an instructor application (Updates status and sends a notification email)
router.post('/instructors/applications/:id/reject',  auth, authorize('admin'), adminInstructor.reject);

// ==== User Management Routes ====

// Fetch a complete list of users (supports searching by name/email and filtering by role)
router.get('/users', auth, authorize('admin'), adminController.getAllUsers);
// Update a specific user's role (e.g., promote a student to instructor/admin)
router.patch('/users/:id/role', auth, authorize('admin'), adminController.updateUserRole);
// Permanently delete a user account from the system
router.delete('/users/:id', auth, authorize('admin'), adminController.deleteUser);

module.exports = router;