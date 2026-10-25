const db = require('../config/db');

const getAppointmentPaymentDetails = async (appointmentId, client = db) => {
  const query = `
    SELECT a.id, a.clinic_id, a.patient_id, a.doctor_id, a.appointment_date,
           a.status, a.payment_due_at, a.amount_due_cents,
           p.name AS patient_name, p.phone_number AS patient_phone,
           COALESCE(NULLIF(TRIM(p.email), ''), u.email) AS patient_email,
           d.name AS doctor_name, d.specialization, d.consultation_fee,
           c.name AS clinic_name, c.email AS clinic_email, c.phone_number AS clinic_phone,
           c.address AS clinic_address
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    LEFT JOIN users u ON u.id = p.user_id
    JOIN doctors d ON d.id = a.doctor_id
    JOIN clinics c ON c.id = a.clinic_id
    WHERE a.id = $1;
  `;
  const result = await client.query(query, [appointmentId]);
  return result.rows[0];
};

const updatePatientPhone = async (patientId, phoneNumber, client = db) => {
  const result = await client.query(
    `UPDATE patients
     SET phone_number = $2
     WHERE id = $1
     RETURNING id, phone_number;`,
    [patientId, phoneNumber]
  );
  return result.rows[0];
};

const createPendingTransaction = async ({
  clinicId,
  patientId,
  appointmentId,
  provider,
  providerIntentionId,
  providerOrderId,
  specialReference,
  amountCents,
  currency,
  clientSecret,
}, client = db) => {
  const result = await client.query(
    `INSERT INTO payment_transactions (
       clinic_id, patient_id, appointment_id, provider,
       provider_intention_id, provider_order_id, special_reference,
       amount_cents, currency, status, client_secret
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10)
     RETURNING *;`,
    [
      clinicId,
      patientId,
      appointmentId,
      provider || 'paymob',
      providerIntentionId || null,
      providerOrderId || null,
      specialReference,
      amountCents,
      currency,
      clientSecret || null,
    ]
  );
  return result.rows[0];
};

const getTransactionForWebhook = async (specialReference, providerOrderId, client = db) => {
  const result = await client.query(
    `SELECT *
     FROM payment_transactions
     WHERE ($1::text IS NOT NULL AND special_reference = $1)
        OR ($2::text IS NOT NULL AND provider_order_id = $2)
     ORDER BY id DESC
     LIMIT 1;`,
    [
      specialReference != null ? String(specialReference) : null,
      providerOrderId != null ? String(providerOrderId) : null,
    ]
  );
  return result.rows[0];
};

const getTransactionByIdForUpdate = async (id, client) => {
  const result = await client.query(
    `SELECT *
     FROM payment_transactions
     WHERE id = $1
     FOR UPDATE;`,
    [id]
  );
  return result.rows[0];
};

const getLatestTransactionForAppointment = async (appointmentId, client = db) => {
  const result = await client.query(
    `SELECT *
     FROM payment_transactions
     WHERE appointment_id = $1
     ORDER BY id DESC
     LIMIT 1;`,
    [appointmentId]
  );
  return result.rows[0];
};

const getPaidTransactionForAppointment = async (appointmentId, client = db) => {
  const result = await client.query(
    `SELECT *
     FROM payment_transactions
     WHERE appointment_id = $1 AND status = 'paid'
     ORDER BY id DESC
     LIMIT 1;`,
    [appointmentId]
  );
  return result.rows[0];
};

const markTransactionPaid = async (
  id,
  { providerTransactionId, paymentMethod, rawResponse },
  client
) => {
  const result = await client.query(
    `UPDATE payment_transactions
     SET status = 'paid',
         provider_transaction_id = $2,
         payment_method = $3,
         hmac_verified = true,
         failure_reason = NULL,
         raw_response = $4,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *;`,
    [id, providerTransactionId || null, paymentMethod || null, rawResponse || null]
  );
  return result.rows[0];
};

const markTransactionFailed = async (id, { providerTransactionId, paymentMethod, failureReason, rawResponse }, client) => {
  const result = await client.query(
    `UPDATE payment_transactions
     SET status = 'failed',
         provider_transaction_id = COALESCE($2, provider_transaction_id),
         payment_method = COALESCE($3, payment_method),
         hmac_verified = true,
         failure_reason = $4,
         raw_response = $5,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *;`,
    [id, providerTransactionId || null, paymentMethod || null, failureReason || null, rawResponse || null]
  );
  return result.rows[0];
};

const markPendingTransactionsExpired = async (appointmentId, client = db) => {
  const result = await client.query(
    `UPDATE payment_transactions
     SET status = 'expired',
         failure_reason = COALESCE(failure_reason, 'Payment window expired'),
         updated_at = CURRENT_TIMESTAMP
     WHERE appointment_id = $1 AND status = 'pending'
     RETURNING *;`,
    [appointmentId]
  );
  return result.rows;
};

const setAppointmentScheduledOnPayment = async (appointmentId, client) => {
  const result = await client.query(
    `UPDATE appointments
     SET status = 'scheduled', paid_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND status = 'awaiting_payment'
     RETURNING *;`,
    [appointmentId]
  );
  return result.rows[0];
};

const listOverdueAwaitingPayment = async (client, now = new Date()) => {
  const result = await client.query(
    `SELECT *
     FROM appointments
     WHERE status = 'awaiting_payment'
       AND (
         (payment_due_at IS NOT NULL AND payment_due_at <= $1)
         OR appointment_date <= $1
       )
     ORDER BY id
     FOR UPDATE SKIP LOCKED;`,
    [now]
  );
  return result.rows;
};

const cancelExpiredAppointment = async (appointmentId, client) => {
  const result = await client.query(
    `UPDATE appointments
     SET status = 'cancelled'
     WHERE id = $1 AND status = 'awaiting_payment'
     RETURNING *;`,
    [appointmentId]
  );
  return result.rows[0];
};

const createPaidBill = async ({ clinicId, patientId, appointmentId, amountCents, description }, client) => {
  const amount = (amountCents / 100).toFixed(2);
  const billResult = await client.query(
    `INSERT INTO bills (
       clinic_id, patient_id, appointment_id,
       subtotal, tax, discount, total_amount, payment_status, payment_method
     )
     VALUES ($1, $2, $3, $4, 0, 0, $4, 'paid', 'online')
     ON CONFLICT DO NOTHING
     RETURNING *;`,
    [clinicId, patientId, appointmentId, amount]
  );
  const bill = billResult.rows[0];
  if (!bill) return null;

  await client.query(
    `INSERT INTO bill_items (bill_id, description, quantity, unit_price, total_price)
     VALUES ($1, $2, 1, $3, $3);`,
    [bill.id, description, amount]
  );
  return bill;
};

module.exports = {
  getAppointmentPaymentDetails,
  updatePatientPhone,
  createPendingTransaction,
  getTransactionForWebhook,
  getTransactionByIdForUpdate,
  getLatestTransactionForAppointment,
  getPaidTransactionForAppointment,
  markTransactionPaid,
  markTransactionFailed,
  markPendingTransactionsExpired,
  setAppointmentScheduledOnPayment,
  listOverdueAwaitingPayment,
  cancelExpiredAppointment,
  createPaidBill,
};
