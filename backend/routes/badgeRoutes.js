const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { getMyBadges } = require('../controllers/badgeController');

router.get('/my-badges', auth, getMyBadges);

module.exports = router;