const express = require('express');
const router = express.Router();
const ownerController = require('../controllers/ownerController');
const { requireClinicScope } = require('../middleware/ownerScope');

router.get('/clinics', ownerController.listMyClinics);
router.get('/clinics/:clinicId/staff', requireClinicScope, ownerController.listStaff);
router.post('/clinics/:clinicId/staff', requireClinicScope, ownerController.createStaff);
router.delete('/clinics/:clinicId/staff/:userId', requireClinicScope, ownerController.removeStaff);
router.get('/clinics/:clinicId/appointments', requireClinicScope, ownerController.listQueue);
router.patch('/appointments/:apptId/approve', ownerController.decideAppointment('approve'));
router.patch('/appointments/:apptId/reject', ownerController.decideAppointment('reject'));
router.get('/clinics/:clinicId/reports/appointments', requireClinicScope, ownerController.reportsAppointments);
router.get('/clinics/:clinicId/reports/billing', requireClinicScope, ownerController.reportsBilling);

module.exports = router;
