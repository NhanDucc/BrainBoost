const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { uploadImage, toCloudinary } = require('../middleware/uploadImage');
const userController = require('../controllers/userController');

router.get('/me', auth, userController.getMe);
router.put('/me', auth, userController.updateMe);
router.put('/me/password', auth, userController.changePassword);
router.put('/me/avatar', auth, uploadImage.single('avatar'), toCloudinary('avatars'), userController.updateAvatar);
router.put('/me/banner', auth, uploadImage.single('banner'), toCloudinary('banners'), userController.updateBanner);
router.put('/me/preferences', auth, userController.updatePreferences);

module.exports = router;