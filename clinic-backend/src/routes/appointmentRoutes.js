const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const { requireRole } = require('../middleware/auth');

router.post('/', requireRole('patient'), appointmentController.bookAppointment);
router.get('/mine', requireRole('patient'), appointmentController.listMyAppointments);
router.get('/', requireRole('doctor', 'receptionist', 'admin'), appointmentController.listAppointments);
router.patch('/:id/approve', requireRole('doctor', 'receptionist', 'admin'), appointmentController.approveAppointment);
router.patch('/:id/reject', requireRole('doctor', 'receptionist', 'admin'), appointmentController.rejectAppointment);
router.patch('/:id/cancel', requireAuth, appointmentController.cancelAppointment);

module.exports = router;