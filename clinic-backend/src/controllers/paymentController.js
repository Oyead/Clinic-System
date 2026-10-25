const appointmentModel = require('../models/appointmentModel');
const paymentModel = require('../models/paymentModel');
const paymobClient = require('../utils/paymobClient');
const paymentService = require('../services/paymentService');

const isValidPositiveId = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

const getConfig = async (req, res) => {
  try {
    res.status(200).json(paymobClient.getPublicConfig());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPatientForAppointment = async (req, appointmentId) => {
  const appointment = await paymentModel.getAppointmentPaymentDetails(appointmentId);
  if (!appointment) return { error: { status: 404, message: 'Appointment not found' } };
  const patient = await appointmentModel.getPatientByUserId(req.user.id);
  if (!patient || Number(patient.id) !== Number(appointment.patient_id)) {
    return { error: { status: 404, message: 'Appointment not found' } };
  }
  return { appointment, patient };
};

const getAppointmentPayment = async (req, res) => {
  try {
    if (!isValidPositiveId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid appointment ID' });
    }
    const access = await getPatientForAppointment(req, req.params.id);
    if (access.error) {
      return res.status(access.error.status).json({ error: access.error.message });
    }
    const status = await paymentService.getPaymentStatus(req.params.id);
    res.status(200).json(status);
  } catch (error) {
    if (error.code === '22P02') {
      return res.status(400).json({ error: 'Invalid appointment ID' });
    }
    res.status(error.status || 500).json({ error: error.message });
  }
};

const createAppointmentIntention = async (req, res) => {
  try {
    if (!isValidPositiveId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid appointment ID' });
    }
    const access = await getPatientForAppointment(req, req.params.id);
    if (access.error) {
      return res.status(access.error.status).json({ error: access.error.message });
    }

    const result = await paymentService.startAppointmentPayment(req.params.id, {
      phoneNumber: req.body ? req.body.phone_number : undefined,
    });

    if (result.already_paid) {
      return res.status(200).json({
        message: 'This appointment is already paid.',
        already_paid: true,
        checkout_url: null,
      });
    }

    return res.status(201).json({
      message: 'Payment intention created.',
      checkout_url: result.checkout_url,
      amount_cents: result.amount_cents,
      currency: result.currency,
      payment_due_at: result.payment_due_at,
      transaction: {
        id: result.transaction.id,
        status: result.transaction.status,
        special_reference: result.transaction.special_reference,
      },
    });
  } catch (error) {
    if (error.code === '22P02') {
      return res.status(400).json({ error: 'Invalid appointment ID' });
    }
    if (error.status) {
      return res.status(error.status).json({
        error: error.message,
        ...(error.code ? { code: error.code } : {}),
      });
    }
    res.status(500).json({ error: error.message });
  }
};

const paymobWebhook = async (req, res) => {
  try {
    const hmac = req.query.hmac || (req.body && req.body.hmac);
    const result = await paymentService.handlePaymobWebhook(req.body, hmac);
    res.status(200).json({ received: true, ...result });
  } catch (error) {
    if (error.status === 400) {
      console.warn('Paymob webhook rejected:', error.message);
      return res.status(400).json({ error: error.message });
    }
    console.error('Paymob webhook failed:', error.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

module.exports = {
  getConfig,
  getAppointmentPayment,
  createAppointmentIntention,
  paymobWebhook,
};
