const appointmentModel = require('../models/appointmentModel');
const { sendMail } = require('./sendpulseMailer');

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const formatAppointmentDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value ?? '');

  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: process.env.APP_TIMEZONE || 'Africa/Cairo',
  }).format(date);
};

const contactLines = (appointment) => {
  const lines = [];
  if (appointment.clinic_address) lines.push(appointment.clinic_address);
  if (appointment.clinic_phone) lines.push(`Phone: ${appointment.clinic_phone}`);
  if (appointment.clinic_email) lines.push(`Email: ${appointment.clinic_email}`);
  return lines;
};

const buildEmail = (appointment, decision) => {
  const approved = decision === 'approve';
  const when = formatAppointmentDate(appointment.appointment_date);
  const duration = appointment.duration_minutes ? `${appointment.duration_minutes} minutes` : '';
  const doctor = appointment.specialization
    ? `${appointment.doctor_name} (${appointment.specialization})`
    : appointment.doctor_name;
  const clinic = appointment.clinic_name;
  const patient = appointment.patient_name || 'there';

  const subject = approved
    ? `Appointment confirmed: ${clinic} - ${when}`
    : `Appointment request declined: ${clinic} - ${when}`;

  const details = [
    `Date and time: ${when}`,
    `Doctor: ${doctor}`,
    `Clinic: ${clinic}`,
    duration ? `Duration: ${duration}` : null,
    ...contactLines(appointment),
  ].filter(Boolean);

  const text = approved
    ? [
        `Hello ${patient},`,
        '',
        `Your appointment at ${clinic} has been approved.`,
        '',
        ...details,
        '',
        'Please arrive a few minutes before your appointment time.',
        '',
        'If you need to make a change, contact the clinic using the details above.',
        '',
        'This is an automated message from the clinic system.',
      ].join('\n')
    : [
        `Hello ${patient},`,
        '',
        `We are sorry, but your appointment request at ${clinic} was not approved.`,
        '',
        ...details,
        '',
        'Please contact the clinic using the details above to arrange another time.',
        '',
        'This is an automated message from the clinic system.',
      ].join('\n');

  const detailRows = [
    ['Date and time', when],
    ['Doctor', doctor],
    ['Clinic', clinic],
    duration ? ['Duration', duration] : null,
    appointment.clinic_address ? ['Address', appointment.clinic_address] : null,
    appointment.clinic_phone ? ['Phone', appointment.clinic_phone] : null,
    appointment.clinic_email ? ['Email', appointment.clinic_email] : null,
  ].filter(Boolean);

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#1f2937;max-width:560px;margin:0 auto;">
      <h2 style="margin:0 0 16px;color:${approved ? '#166534' : '#991b1b'};">
        ${approved ? 'Appointment confirmed' : 'Appointment request declined'}
      </h2>
      <p style="margin:0 0 12px;">Hello ${escapeHtml(patient)},</p>
      <p style="margin:0 0 20px;">
        ${approved
          ? `Your appointment at <strong>${escapeHtml(clinic)}</strong> has been approved.`
          : `We are sorry, but your appointment request at <strong>${escapeHtml(clinic)}</strong> was not approved.`}
      </p>
      <table role="presentation" style="border-collapse:collapse;width:100%;margin:0 0 20px;">
        ${detailRows
          .map(
            ([label, value]) => `
          <tr>
            <td style="padding:6px 12px 6px 0;font-weight:bold;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td>
            <td style="padding:6px 0;vertical-align:top;">${escapeHtml(value)}</td>
          </tr>`
          )
          .join('')}
      </table>
      <p style="margin:0 0 12px;">
        ${approved
          ? 'Please arrive a few minutes before your appointment time.'
          : 'Please contact the clinic using the details above to arrange another time.'}
      </p>
      <p style="margin:24px 0 0;font-size:12px;color:#6b7280;">
        This is an automated message from the clinic system.
      </p>
    </div>
  `;

  return { subject, text, html };
};

const sendAppointmentDecisionEmail = async (appointmentId, decision) => {
  try {
    if (decision !== 'approve' && decision !== 'reject') {
      console.warn(`Email notification skipped: unknown decision "${decision}".`);
      return { sent: false, skipped: true, reason: 'unknown decision' };
    }

    const appointment = await appointmentModel.getAppointmentNotificationById(appointmentId);
    if (!appointment) {
      console.warn(`Email notification skipped: appointment ${appointmentId} was not found.`);
      return { sent: false, skipped: true, reason: 'appointment not found' };
    }

    if (!appointment.patient_email) {
      console.warn(`Email notification skipped: appointment ${appointmentId} has no patient email.`);
      return { sent: false, skipped: true, reason: 'patient email missing' };
    }

    const { subject, text, html } = buildEmail(appointment, decision);

    return await sendMail({
      to: appointment.patient_email,
      toName: appointment.patient_name,
      subject,
      text,
      html,
      fromName: appointment.clinic_name || 'Clinic System',
      replyTo: appointment.clinic_email
        ? { name: appointment.clinic_name, email: appointment.clinic_email }
        : null,
    });
  } catch (error) {
    console.warn('Email notification failed:', error.message);
    return { sent: false, error: error.message };
  }
};

const formatMoney = (cents, currency = 'EGP') => {
  const amount = Number(cents);
  if (!Number.isFinite(amount)) return `${currency} 0.00`;
  return new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount / 100);
};

const paymentAmount = (appointment) => {
  if (appointment.amount_due_cents != null) return Number(appointment.amount_due_cents);
  if (appointment.consultation_fee != null) return Math.round(Number(appointment.consultation_fee) * 100);
  return 0;
};

const paymentDetailRows = (appointment, checkoutUrl = '') => {
  const when = formatAppointmentDate(appointment.appointment_date);
  const amount = formatMoney(paymentAmount(appointment));
  const due = appointment.payment_due_at ? formatAppointmentDate(appointment.payment_due_at) : '';
  return [
    ['Appointment', when],
    ['Doctor', appointment.specialization
      ? `${appointment.doctor_name} (${appointment.specialization})`
      : appointment.doctor_name],
    ['Clinic', appointment.clinic_name],
    ['Amount', amount],
    due ? ['Pay before', due] : null,
    checkoutUrl ? ['Pay now', checkoutUrl] : null,
    appointment.clinic_address ? ['Address', appointment.clinic_address] : null,
    appointment.clinic_phone ? ['Phone', appointment.clinic_phone] : null,
    appointment.clinic_email ? ['Email', appointment.clinic_email] : null,
  ].filter(Boolean);
};

const paymentText = (heading, intro, appointment, checkoutUrl = '') => {
  const details = paymentDetailRows(appointment, checkoutUrl).map(([label, value]) => `${label}: ${value}`);
  return [
    `Hello ${appointment.patient_name || 'there'},`,
    '',
    intro,
    '',
    ...details,
    '',
    'This is an automated message from the clinic system.',
  ].join('\n');
};

const paymentHtml = (heading, intro, appointment, checkoutUrl = '') => {
  const rows = paymentDetailRows(appointment, checkoutUrl);
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#1f2937;max-width:560px;margin:0 auto;">
      <h2 style="margin:0 0 16px;color:#8d6717;">${escapeHtml(heading)}</h2>
      <p style="margin:0 0 12px;">Hello ${escapeHtml(appointment.patient_name || 'there')},</p>
      <p style="margin:0 0 20px;">${escapeHtml(intro)}</p>
      <table role="presentation" style="border-collapse:collapse;width:100%;margin:0 0 20px;">
        ${rows.map(([label, value]) => `
          <tr>
            <td style="padding:6px 12px 6px 0;font-weight:bold;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td>
            <td style="padding:6px 0;vertical-align:top;${label === 'Pay now' ? 'overflow-wrap:anywhere;' : ''}">${
              label === 'Pay now'
                ? `<a href="${escapeHtml(value)}">${escapeHtml(value)}</a>`
                : escapeHtml(value)
            }</td>
          </tr>`).join('')}
      </table>
      ${checkoutUrl ? '<p style="margin:0 0 12px;">Complete payment to confirm your appointment. The slot is held until the payment deadline.</p>' : ''}
      <p style="margin:24px 0 0;font-size:12px;color:#6b7280;">
        This is an automated message from the clinic system.
      </p>
    </div>
  `;
};

const sendPaymentEmail = async (appointmentId, { heading, intro, subject, checkoutUrl = '' }) => {
  try {
    const appointment = await appointmentModel.getAppointmentNotificationById(appointmentId);
    if (!appointment) {
      console.warn(`Payment email skipped: appointment ${appointmentId} was not found.`);
      return { sent: false, skipped: true, reason: 'appointment not found' };
    }
    if (!appointment.patient_email) {
      console.warn(`Payment email skipped: appointment ${appointmentId} has no patient email.`);
      return { sent: false, skipped: true, reason: 'patient email missing' };
    }
    return await sendMail({
      to: appointment.patient_email,
      toName: appointment.patient_name,
      subject,
      text: paymentText(heading, intro, appointment, checkoutUrl),
      html: paymentHtml(heading, intro, appointment, checkoutUrl),
      fromName: appointment.clinic_name || 'Clinic System',
      replyTo: appointment.clinic_email
        ? { name: appointment.clinic_name, email: appointment.clinic_email }
        : null,
    });
  } catch (error) {
    console.warn('Payment email failed:', error.message);
    return { sent: false, error: error.message };
  }
};

const sendAppointmentPaymentRequiredEmail = async (appointmentId, checkoutUrl) =>
  sendPaymentEmail(appointmentId, {
    heading: 'Payment required to confirm your appointment',
    intro: 'Your appointment request was approved. Please complete payment to confirm your slot.',
    subject: 'Payment required for your appointment',
    checkoutUrl,
  });

const sendAppointmentPaymentConfirmedEmail = async (appointmentId) =>
  sendPaymentEmail(appointmentId, {
    heading: 'Payment received - appointment confirmed',
    intro: 'We received your payment and your appointment is confirmed.',
    subject: 'Payment received - appointment confirmed',
  });

const sendAppointmentPaymentExpiredEmail = async (appointmentId) =>
  sendPaymentEmail(appointmentId, {
    heading: 'Your appointment request expired',
    intro: 'The payment window for this appointment has passed, so the held slot was released. You can book another appointment at any time.',
    subject: 'Appointment request expired - payment not received',
  });

module.exports = {
  sendAppointmentDecisionEmail,
  sendAppointmentPaymentRequiredEmail,
  sendAppointmentPaymentConfirmedEmail,
  sendAppointmentPaymentExpiredEmail,
};

