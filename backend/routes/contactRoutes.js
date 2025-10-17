// backend/routes/contactRoutes.js
const router = require('express').Router();
const { auth } = require('../middleware/auth');
const contactController = require('../controllers/contactController');

router.post('/', auth, contactController.send);

module.exports = router;
