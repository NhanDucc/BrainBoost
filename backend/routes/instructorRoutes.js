const router = require('express').Router();
const { auth, authorize } = require('../middleware/auth');
const instructorController = require('../controllers/instructorController')

router.get('/my-courses', auth, authorize('instructor', 'admin'), (req, res) => {
    res.json({ ok: true, who: req.userRole, msg: 'Instructor courses' });
});

router.post('/apply', instructorController.apply);

module.exports = router;