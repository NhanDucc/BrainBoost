const router = require('express').Router();
const { auth } = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const admin = require('../controllers/adminInstructorController');

router.get('/applications', auth, requireRole('admin'), admin.list);
router.patch('/applications/:id/approve', auth, requireRole('admin'), admin.approve);
router.patch('/applications/:id/reject', auth, requireRole('admin'), admin.reject);

module.exports = router;
