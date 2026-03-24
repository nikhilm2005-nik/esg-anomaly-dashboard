const express = require('express');
const router = express.Router();
const controller = require('../controllers/esgController');

router.get('/:companyId', controller.getESGByCompany);
router.get('/compare/:id1/:id2', controller.compareCompanies);

module.exports = router;