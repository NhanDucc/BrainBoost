const router = require('express').Router();
const { auth, authorize } = require('../middleware/auth');
const adminInstructor = require('../controllers/adminInstructorController');

router.get('/stats', auth, authorize('admin'), (req, res) => {
    res.json({ ok: true, who: req.userRole, msg: 'Admin stats here' });
});

router.get('/instructors/applications', auth, authorize('admin'), adminInstructor.list);
router.post('/instructors/applications/:id/approve', auth, authorize('admin'), adminInstructor.approve);
router.post('/instructors/applications/:id/reject',  auth, authorize('admin'), adminInstructor.reject);

module.exports = router;