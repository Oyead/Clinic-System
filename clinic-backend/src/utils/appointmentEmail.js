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

module.exports = { sendAppointmentDecisionEmail };
