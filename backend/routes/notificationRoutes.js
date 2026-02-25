const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { auth } = require('../middleware/auth');

// Lấy danh sách thông báo của người dùng hiện tại
router.get('/', auth, notificationController.getMyNotifications);

// Đánh dấu 1 thông báo cụ thể là đã đọc
router.put('/:id/read', auth, notificationController.markAsRead);

// Đánh dấu tất cả thông báo là đã đọc
router.put('/read', auth, notificationController.markAllAsRead);

module.exports = router;