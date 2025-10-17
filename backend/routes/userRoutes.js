const express = require('express');
const router = express.Router();

const { auth } = require('../middleware/auth');
const upload = require('../middleware/upload');
const userCtrl = require('../controllers/userController');

router.get('/me', auth, userCtrl.getMe);
router.put('/me', auth, userCtrl.updateMe);
router.put('/me/password', auth, userCtrl.changePassword);

router.put('/me/avatar', auth, upload.single('avatar'), userCtrl.updateAvatar);
router.put('/me/banner', auth, upload.single('banner'), userCtrl.updateBanner);

module.exports = router;
