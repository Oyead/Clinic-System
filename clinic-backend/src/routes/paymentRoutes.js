const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/config', requireAuth, paymentController.getConfig);
router.get(
  '/appointments/:id',
  requireAuth,
  requireRole('patient'),
  paymentController.getAppointmentPayment
);
router.post(
  '/appointments/:id/intention',
  requireAuth,
  requireRole('patient'),
  paymentController.createAppointmentIntention
);

router.post('/paymob/webhook', paymentController.paymobWebhook);

module.exports = router;
