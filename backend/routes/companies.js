const express = require('express');
const router = express.Router();
const controller = require('../controllers/companiesController');

router.get('/', controller.getAllCompanies);
router.get('/recent', controller.getRecentCompanies);
router.get('/:id', controller.getCompanyById);
router.post('/add', controller.addCompany);
router.put('/update/:id', controller.updateCompany);
router.delete('/delete/:id', controller.deleteCompany);

module.exports = router;