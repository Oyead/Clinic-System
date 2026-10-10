const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

router.post('/clinics', adminController.addClinic);
router.post('/doctors', adminController.addDoctor);
router.put('/doctors/:id/assign', adminController.assignDoctor);
router.post('/users', adminController.addUser);
router.get('/users', adminController.listUsers);
router.patch('/users/:id/role', adminController.updateUserRole);
router.delete('/users/:id', adminController.deleteUser);
router.get('/audit-logs', adminController.listAuditLogs);
router.post('/receptionists', adminController.addReceptionist);
router.put('/receptionists/:id/assign', adminController.assignReceptionist);
router.get('/patients', adminController.listPatients);
router.put('/patients/:id/link-user', adminController.linkPatient);

module.exports = router;