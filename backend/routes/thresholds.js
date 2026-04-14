const express = require('express');
const router = express.Router();
const controller = require('../controllers/thresholdsController');

router.get('/', controller.getAllThresholds);
router.get('/:sector', controller.getThresholdsBySector);
router.put('/update/:id', controller.updateThreshold);

module.exports = router;