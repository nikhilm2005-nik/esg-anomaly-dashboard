const express = require('express');
const router = express.Router();
const controller = require('../controllers/anomalyController');

router.get('/', controller.getAllAnomalies);
router.get('/:companyId', controller.getAnomaliesByCompany);

module.exports = router;