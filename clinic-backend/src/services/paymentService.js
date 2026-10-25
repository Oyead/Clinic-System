const crypto = require('crypto');
const db = require('../config/db');
const paymentModel = require('../models/paymentModel');
const availabilityModel = require('../models/availabilityModel');
const adminModel = require('../models/adminModel');
const paymobClient = require('../utils/paymobClient');
const {
  sendAppointmentPaymentRequiredEmail,
  sendAppointmentPaymentConfirmedEmail,
  sendAppointmentPaymentExpiredEmail,
} = require('../utils/appointmentEmail');

const httpError = (status, message, code) => {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
};

const normalizePhone = (value) => {
  if (typeof value !== 'string') return '';
  const phone = value.trim();
  if (!phone) return '';
  if (!/^[+0-9 ()-]{7,50}$/.test(phone)) return '';
  return phone;
};

const splitName = (name) => {
  const parts = String(name || 'Patient').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: 'Patient', last: 'Patient' };
  if (parts.length === 1) return { first: parts[0], last: parts[0] };
  return { first: parts[0], last: parts.slice(1).join(' ') };
};

const buildBillingData = (appointment, phoneNumber) => {
  const { first, last } = splitName(appointment.patient_name);
  return {
    first_name: first,
    last_name: last,
    email: appointment.patient_email || 'patient@example.com',
    phone_number: phoneNumber,
    city: 'Cairo',
    country: 'EG',
    street: appointment.clinic_address || 'NA',
    building: 'NA',
    floor: 'NA',
    apartment: 'NA',
    state: 'Cairo',
    postal_code: 'NA',
  };
};

const amountCentsFor = (appointment) => {
  if (appointment.amount_due_cents != null && Number(appointment.amount_due_cents) > 0) {
    return Number(appointment.amount_due_cents);
  }
  const fee = Number(appointment.consultation_fee);
  if (!Number.isFinite(fee) || fee <= 0) return 0;
  return Math.round(fee * 100);
};

const paymentDueFor = (appointmentDate) => {
  const config = paymobClient.getConfig();
  const hours = Number.isFinite(config.expiryHours) && config.expiryHours > 0
    ? config.expiryHours
    : 24;
  const now = Date.now();
  const appointmentTime = new Date(appointmentDate).getTime();
  const deadline = Math.min(
    now + hours * 60 * 60 * 1000,
    Number.isFinite(appointmentTime) ? appointmentTime : now + hours * 60 * 60 * 1000
  );
  return new Date(deadline);
};

const isExpired = (appointment) => {
  const now = Date.now();
  if (appointment.payment_due_at && new Date(appointment.payment_due_at).getTime() <= now) {
    return true;
  }
  if (appointment.appointment_date && new Date(appointment.appointment_date).getTime() <= now) {
    return true;
  }
  return false;
};

const startAppointmentPayment = async (appointmentId, { phoneNumber } = {}) => {
  const appointment = await paymentModel.getAppointmentPaymentDetails(appointmentId);
  if (!appointment) throw httpError(404, 'Appointment not found');

  const paid = await paymentModel.getPaidTransactionForAppointment(appointmentId);
  if (paid) {
    return {
      already_paid: true,
      appointment,
      transaction: paid,
      checkout_url: null,
    };
  }

  if (appointment.status !== 'awaiting_payment') {
    throw httpError(400, 'This appointment is not waiting for payment');
  }
  if (isExpired(appointment)) {
    await expireOverduePayments();
    throw httpError(400, 'The payment window for this appointment has expired');
  }

  const phone = normalizePhone(phoneNumber);
  if (phoneNumber !== undefined && phoneNumber !== null && String(phoneNumber).trim() && !phone) {
    throw httpError(400, 'Please enter a valid phone number');
  }
  if (phone) {
    await paymentModel.updatePatientPhone(appointment.patient_id, phone);
  }

  const paymentPhone = phone || normalizePhone(appointment.patient_phone);
  if (!paymentPhone) {
    throw httpError(
      400,
      'A phone number is required for online payment. Add one to continue.',
      'phone_required'
    );
  }

  const amountCents = amountCentsFor(appointment);
  if (!amountCents) {
    throw httpError(400, 'This appointment has no consultation fee to pay');
  }

  const latest = await paymentModel.getLatestTransactionForAppointment(appointmentId);
  if (
    latest &&
    latest.status === 'pending' &&
    latest.client_secret &&
    Number(latest.amount_cents) === amountCents
  ) {
    return {
      appointment,
      transaction: latest,
      checkout_url: paymobClient.getCheckoutUrl(latest.client_secret),
      payment_due_at: appointment.payment_due_at,
      amount_cents: amountCents,
      currency: latest.currency,
    };
  }

  const config = paymobClient.getConfig();
  const specialReference = `appt-${appointment.id}-${Date.now().toString(36)}-${crypto
    .randomBytes(4)
    .toString('hex')}`;
  const dueAt = appointment.payment_due_at ? new Date(appointment.payment_due_at).getTime() : NaN;
  const expiration = Number.isFinite(dueAt)
    ? Math.max(60, Math.floor((dueAt - Date.now()) / 1000))
    : Math.round(config.expiryHours * 3600);
  const intention = await paymobClient.createIntention({
    amountCents,
    currency: config.currency,
    billingData: buildBillingData(appointment, paymentPhone),
    specialReference,
    expiration,
    items: [
      {
        name: `Consultation - ${appointment.doctor_name}`,
        amount: amountCents,
        description: `${appointment.specialization || 'Consultation'} at ${appointment.clinic_name}`,
        quantity: 1,
      },
    ],
  });

  const checkoutUrl = paymobClient.getCheckoutUrl(intention.client_secret);
  const transaction = await paymentModel.createPendingTransaction({
    clinicId: appointment.clinic_id,
    patientId: appointment.patient_id,
    appointmentId: appointment.id,
    provider: 'paymob',
    providerIntentionId: intention.id != null ? String(intention.id) : null,
    providerOrderId: intention.intention_order_id != null ? String(intention.intention_order_id) : null,
    specialReference,
    amountCents,
    currency: config.currency,
    clientSecret: intention.client_secret,
  });

  return {
    appointment,
    transaction,
    checkout_url: checkoutUrl,
    payment_due_at: appointment.payment_due_at,
    amount_cents: amountCents,
    currency: config.currency,
  };
};

const getPaymentStatus = async (appointmentId) => {
  const appointment = await paymentModel.getAppointmentPaymentDetails(appointmentId);
  if (!appointment) throw httpError(404, 'Appointment not found');

  const paid = await paymentModel.getPaidTransactionForAppointment(appointmentId);
  const latest = paid || await paymentModel.getLatestTransactionForAppointment(appointmentId);
  let paymentStatus = 'unpaid';
  if (paid) paymentStatus = 'paid';
  else if (appointment.status === 'awaiting_payment') paymentStatus = 'pending';
  else if (latest && latest.status === 'failed') paymentStatus = 'failed';
  else if (latest && latest.status === 'expired') paymentStatus = 'expired';

  return {
    appointment_id: appointment.id,
    appointment_status: appointment.status,
    payment_status: paymentStatus,
    amount_cents: amountCentsFor(appointment),
    currency: (latest && latest.currency) || paymobClient.getConfig().currency,
    payment_due_at: appointment.payment_due_at,
    patient_phone: appointment.patient_phone,
    checkout_url:
      latest && latest.status === 'pending' && latest.client_secret
        ? paymobClient.getCheckoutUrl(latest.client_secret)
        : null,
    transaction: latest || null,
  };
};

const webhookFailureReason = (object) => {
  if (object && object.data && object.data.message) return String(object.data.message);
  if (object && object.data && object.data.txn_response_code) {
    return String(object.data.txn_response_code);
  }
  return 'Payment failed';
};

const handlePaymobWebhook = async (payload, receivedHmac) => {
  if (payload && typeof payload === 'object' && payload.type && payload.type !== 'TRANSACTION') {
    return { ignored: true, reason: payload.type };
  }

  const object = payload && payload.obj ? payload.obj : payload;
  if (!object || typeof object !== 'object') {
    throw httpError(400, 'Invalid webhook payload');
  }
  if (!paymobClient.verifyWebhookHmac(object, receivedHmac)) {
    throw httpError(400, 'Invalid Paymob HMAC signature');
  }

  if (object.pending === true) {
    return { ignored: true, reason: 'pending' };
  }

  const order = object.order || {};
  const transaction = await paymentModel.getTransactionForWebhook(
    order.merchant_order_id != null ? String(order.merchant_order_id) : null,
    order.id != null ? String(order.id) : null
  );
  if (!transaction) {
    return { ignored: true, reason: 'unknown transaction' };
  }

  const providerTransactionId = object.id != null ? String(object.id) : null;
  const paymentMethod = object.source_data && object.source_data.type
    ? String(object.source_data.type)
    : null;

  if (object.success !== true) {
    if (transaction.status === 'paid') {
      return { ignored: true, reason: 'already paid' };
    }
    const failed = await db.withTransaction(async (client) => {
      const locked = await paymentModel.getTransactionByIdForUpdate(transaction.id, client);
      if (!locked || locked.status === 'paid') return locked;
      return paymentModel.markTransactionFailed(
        locked.id,
        {
          providerTransactionId,
          paymentMethod,
          failureReason: webhookFailureReason(object),
          rawResponse: object,
        },
        client
      );
    });
    return { failed: true, transaction: failed };
  }

  if (transaction.status === 'paid') {
    return { already_paid: true, transaction };
  }

  if (
    Number(object.amount_cents) !== Number(transaction.amount_cents) ||
    String(object.currency || '').toUpperCase() !== String(transaction.currency).toUpperCase()
  ) {
    throw httpError(400, 'Payment amount or currency does not match the stored intention');
  }

  const result = await db.withTransaction(async (client) => {
    const locked = await paymentModel.getTransactionByIdForUpdate(transaction.id, client);
    if (!locked) throw httpError(404, 'Payment transaction not found');
    if (locked.status === 'paid') {
      return { already_paid: true, transaction: locked, appointment: null };
    }

    const paidTransaction = await paymentModel.markTransactionPaid(
      locked.id,
      {
        providerTransactionId,
        paymentMethod,
        rawResponse: object,
      },
      client
    );

    const appointment = await paymentModel.setAppointmentScheduledOnPayment(
      locked.appointment_id,
      client
    );

    await paymentModel.createPaidBill(
      {
        clinicId: locked.clinic_id,
        patientId: locked.patient_id,
        appointmentId: locked.appointment_id,
        amountCents: locked.amount_cents,
        description: `Consultation payment - appointment #${locked.appointment_id}`,
      },
      client
    );

    await adminModel.createAuditLog(
      {
        action: appointment ? 'appointment_payment_received' : 'appointment_payment_received_late',
        appointment_id: locked.appointment_id,
        old_status: appointment ? 'awaiting_payment' : null,
        new_status: appointment ? 'scheduled' : null,
        clinic_id: locked.clinic_id,
      },
      client
    );

    return {
      paid: true,
      transaction: paidTransaction,
      appointment,
      already_paid: false,
    };
  });

  if (result.paid && result.appointment) {
    void sendAppointmentPaymentConfirmedEmail(result.appointment.id);
  }

  return result;
};

const expireOverduePayments = async () => {
  const expired = await db.withTransaction(async (client) => {
    const rows = await paymentModel.listOverdueAwaitingPayment(client);
    const cancelled = [];
    for (const row of rows) {
      const updated = await paymentModel.cancelExpiredAppointment(row.id, client);
      if (!updated) continue;
      await paymentModel.markPendingTransactionsExpired(row.id, client);
      if (row.slot_id) {
        await availabilityModel.setSlotStatus(row.slot_id, 'open', client);
      }
      await adminModel.createAuditLog(
        {
          action: 'appointment_payment_expired',
          appointment_id: row.id,
          old_status: 'awaiting_payment',
          new_status: 'cancelled',
          clinic_id: row.clinic_id,
        },
        client
      );
      cancelled.push(updated);
    }
    return cancelled;
  });

  for (const appointment of expired) {
    void sendAppointmentPaymentExpiredEmail(appointment.id);
  }
  return expired;
};

const notifyPaymentRequired = async (appointmentId) => {
  let checkoutUrl = '';
  try {
    const payment = await startAppointmentPayment(appointmentId);
    checkoutUrl = payment.checkout_url || '';
  } catch (error) {
    console.warn(`Payment intention for appointment ${appointmentId} was not created:`, error.message);
  }
  await sendAppointmentPaymentRequiredEmail(appointmentId, checkoutUrl);
};

module.exports = {
  paymentDueFor,
  amountCentsFor,
  startAppointmentPayment,
  getPaymentStatus,
  handlePaymobWebhook,
  expireOverduePayments,
  notifyPaymentRequired,
};
