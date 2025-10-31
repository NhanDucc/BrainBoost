const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { uploadImage, toCloudinary } = require('../middleware/uploadImage');
const userCtrl = require('../controllers/userController');

router.get('/me', auth, userCtrl.getMe);
router.put('/me', auth, userCtrl.updateMe);
router.put('/me/password', auth, userCtrl.changePassword);

router.put('/me/avatar', auth, uploadImage.single('avatar'), toCloudinary('avatars'), userCtrl.updateAvatar);
router.put('/me/banner', auth, uploadImage.single('banner'), toCloudinary('banners'), userCtrl.updateBanner);

module.exports = router;