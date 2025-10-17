const express = require('express');
const { register, login, verify } = require('../controllers/authController');
const authController = require('../controllers/authController');
const router = express.Router();

router.post('/register', register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/forgot-password/otp', authController.sendForgotPasswordOtp);
router.post('/verify', verify);
router.post('/reset-password', authController.resetPassword);

module.exports = router;