const express = require('express');
const router = express.Router();
const controller = require('../controllers/dashboardController');

router.get('/stats', controller.getDashboardStats);

module.exports = router;