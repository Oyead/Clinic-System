const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

router.post('/clinics', adminController.addClinic);
router.get('/clinics', adminController.listClinics);
router.patch('/clinics/:id/approve', adminController.approveClinic);
router.post('/admins', adminController.createAdmin);
router.post('/staff/invite', adminController.inviteStaff);
// Retired flows (410 with guidance): generic addUser, profile surgery,
// in-place reassignment, arbitrary role changes.
router.post('/doctors', adminController.addDoctor);
router.put('/doctors/:id/assign', adminController.assignDoctor);
router.post('/users', adminController.addUser);
router.get('/users', adminController.listUsers);
router.patch('/users/:id/role', adminController.updateUserRole);
router.post('/users/:id/suspend', adminController.suspendUser);
router.post('/users/:id/reinstate', adminController.reinstateUser);
router.post('/users/:id/offboard', adminController.offboardUser);
router.delete('/users/:id', adminController.deleteUser);
router.get('/audit-logs', adminController.listAuditLogs);
router.post('/receptionists', adminController.addReceptionist);
router.put('/receptionists/:id/assign', adminController.assignReceptionist);
router.get('/patients', adminController.listPatients);
router.put('/patients/:id/link-user', adminController.linkPatient);

module.exports = router;
