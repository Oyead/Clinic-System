const express = require('express');
const router = express.Router();
const availabilityController = require('../controllers/availabilityController');
const { requireRole } = require('../middleware/auth');

router.get(
  '/',
  requireRole('patient', 'doctor', 'receptionist', 'clinic_owner', 'admin'),
  availabilityController.listAvailability
);
router.post(
  '/',
  requireRole('doctor', 'receptionist', 'clinic_owner', 'admin'),
  availabilityController.createAvailability
);
router.delete(
  '/:id',
  requireRole('doctor', 'receptionist', 'clinic_owner', 'admin'),
  availabilityController.removeAvailability
);

module.exports = router;
