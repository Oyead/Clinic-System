const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

router.post('/clinics', adminController.addClinic);
router.post('/doctors', adminController.addDoctor);
router.put('/doctors/:id/assign', adminController.assignDoctor);

module.exports = router;