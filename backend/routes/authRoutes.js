const express = require('express');
const authController = require('../controllers/authController');
const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/refresh', authController.refreshToken);
router.post('/forgot-password/otp', authController.sendForgotPasswordOtp);
router.post('/verify', authController.verify);
router.post('/reset-password', authController.resetPassword);

module.exports = router;