const appointmentModel = require('../models/appointmentModel');
const availabilityModel = require('../models/availabilityModel');
const adminModel = require('../models/adminModel');
const ownerModel = require('../models/ownerModel');
const db = require('../config/db');
const { normalizeRole } = require('../utils/roles');
const { parseDateRange } = require('../utils/range');

const VALID_STATUSES = ['scheduled', 'completed', 'cancelled', 'no_show', 'pending'];

const isValidPositiveId = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

const canManageAppointment = async (req, appointment) => {
  if (req.user.role === 'admin') {
    return true;
  }
  if (req.user.role === 'doctor') {
    const doctor = await appointmentModel.getDoctorByUserId(req.user.id);
    return !!doctor && doctor.id === appointment.doctor_id;
  }
  if (req.user.role === 'receptionist') {
    const receptionist = await appointmentModel.getReceptionistByUserId(req.user.id);
    return !!receptionist && receptionist.clinic_id === appointment.clinic_id;
  }
  if (req.user.role === 'clinic_owner' || req.user.role === 'owner') {
    const owned = await ownerModel.getOwnerClinicIds(req.user.id);
    return owned.includes(Number(appointment.clinic_id));
  }
  return false;
};

const bookAppointment = async (req, res) => {
  try {
    // Slot-based booking: patient picks one of the published 45-minute slots.
    if (req.body && req.body.slot_id !== undefined && req.body.slot_id !== null && req.body.slot_id !== '') {
      return bookSlotAppointment(req, res);
    }

    const { clinic_id, doctor_id, appointment_date, duration_minutes, reason } = req.body;

    if (!clinic_id || !doctor_id || !appointment_date) {
      return res.status(400).json({ error: 'clinic_id, doctor_id, and appointment_date are required' });
    }

    if (!isValidPositiveId(clinic_id) || !isValidPositiveId(doctor_id)) {
      return res.status(400).json({ error: 'clinic_id and doctor_id must be positive integers' });
    }

    let durationOverride = null;
    if (duration_minutes !== undefined && duration_minutes !== null) {
      durationOverride = Number(duration_minutes);
      if (!Number.isInteger(durationOverride) || durationOverride <= 0 || durationOverride > 480) {
        return res.status(400).json({ error: 'duration_minutes must be an integer between 1 and 480' });
      }
    }

    const date = new Date(appointment_date);
    if (Number.isNaN(date.getTime())) {
      return res.status(400).json({ error: 'appointment_date must be a valid date' });
    }
    if (date.getTime() <= Date.now()) {
      return res.status(400).json({ error: 'appointment_date must be in the future' });
    }

    const patient = await appointmentModel.getPatientByUserId(req.user.id);
    if (!patient) {
      return res.status(400).json({
        error: 'No patient profile is linked to your account. Please contact the clinic to book.',
      });
    }

    const clinic = await appointmentModel.getClinicById(clinic_id);
    if (!clinic) {
      return res.status(400).json({ error: 'The selected clinic does not exist' });
    }

    const doctor = await appointmentModel.getDoctorById(doctor_id);
    if (!doctor) {
      return res.status(400).json({ error: 'The selected doctor does not exist' });
    }

    if (Number(doctor.clinic_id) !== Number(clinic_id)) {
      return res.status(400).json({ error: 'The selected doctor is not assigned to the selected clinic' });
    }

    const duration = durationOverride ?? doctor.duration_minutes ?? 30;
    const end = new Date(date.getTime() + duration * 60000);

    const open = await appointmentModel.isWithinOperatingHours(clinic_id, date.toISOString(), end.toISOString());
    if (!open) {
      return res.status(400).json({ error: 'The clinic is closed at the requested time' });
    }

    const overlap = await appointmentModel.getAppointmentOverlap(doctor_id, date.toISOString(), end.toISOString());
    if (overlap) {
      return res.status(409).json({ error: 'The doctor already has a pending or scheduled appointment overlapping this time' });
    }

    const appointment = await appointmentModel.createAppointment({
      clinicId: clinic_id,
      patientId: patient.id,
      doctorId: doctor_id,
      appointmentDate: date,
      durationMinutes: duration,
      reason,
    });

    res.status(201).json({
      message: 'Appointment requested successfully. It becomes active once approved by the clinic.',
      appointment,
    });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(400).json({ error: 'A referenced clinic, doctor, or patient does not exist' });
    }

    if (error.code === '23505' || error.code === '23P01') {
      return res.status(409).json({ error: 'The doctor already has a pending or scheduled appointment overlapping this time' });
    }

    if (error.code === '23514') {
      return res.status(400).json({ error: 'Invalid duration provided' });
    }

    if (error.code === '22P02') {
      return res.status(400).json({ error: 'Invalid value provided' });
    }

    res.status(500).json({ error: error.message });
  }
};

const bookSlotAppointment = async (req, res) => {
  try {
    const { slot_id, reason } = req.body;
    if (!isValidPositiveId(slot_id)) {
      return res.status(400).json({ error: 'slot_id must be a positive integer' });
    }
    const patient = await appointmentModel.getPatientByUserId(req.user.id);
    if (!patient) {
      return res.status(400).json({
        error: 'No patient profile is linked to your account. Please contact the clinic to book.',
      });
    }
    try {
      const appointment = await db.withTransaction(async (client) => {
        const slot = await availabilityModel.getSlotByIdForUpdate(slot_id, client);
        if (!slot) {
          const error = new Error('This time slot is no longer available.');
          error.status = 404;
          throw error;
        }
        if (slot.status !== 'open') {
          const error = new Error('This time slot has just been taken. Please choose another one.');
          error.status = 409;
          throw error;
        }
        if (new Date(slot.starts_at).getTime() <= Date.now()) {
          const error = new Error('This time slot is in the past. Please choose another one.');
          error.status = 400;
          throw error;
        }
        const created = await client.query(
          `INSERT INTO appointments (clinic_id, patient_id, doctor_id, appointment_date, duration_minutes, status, reason, slot_id)
           VALUES ($1, $2, $3, $4, 45, 'pending', $5, $6)
           RETURNING *;`,
          [slot.clinic_id, patient.id, slot.doctor_id, slot.starts_at, reason || null, slot.id]
        );
        await availabilityModel.setSlotStatus(slot.id, 'booked', client);
        return created.rows[0];
      });
      res.status(201).json({
        message: 'Appointment requested successfully. It becomes active once approved by the clinic.',
        appointment,
      });
    } catch (error) {
      if (error.status) return res.status(error.status).json({ error: error.message });
      if (error.code === '23505' || error.code === '23P01') {
        return res.status(409).json({ error: 'This time slot has just been taken. Please choose another one.' });
      }
      throw error;
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const listMyAppointments = async (req, res) => {
  try {
    const patient = await appointmentModel.getPatientByUserId(req.user.id);
    if (!patient) {
      return res.status(200).json({ appointments: [] });
    }
    const { range, error: rangeError } = parseDateRange(req.query);
    if (rangeError) {
      return res.status(400).json({ error: rangeError });
    }
    const appointments = await appointmentModel.listAppointmentsByPatientId(patient.id, range);
    res.status(200).json({ appointments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const listAppointments = async (req, res) => {
  try {
    const { status } = req.query;

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const { range, error: rangeError } = parseDateRange(req.query);
    if (rangeError) {
      return res.status(400).json({ error: rangeError });
    }

    let appointments;
    if (req.user.role === 'doctor') {
      const doctor = await appointmentModel.getDoctorByUserId(req.user.id);
      appointments = doctor
        ? await appointmentModel.listAppointmentsByDoctorId(doctor.id, status, range)
        : [];
    } else if (req.user.role === 'receptionist') {
      const receptionist = await appointmentModel.getReceptionistByUserId(req.user.id);
      appointments = receptionist
        ? await appointmentModel.listAppointmentsByClinicId(receptionist.clinic_id, status, range)
        : [];
    } else {
      appointments = await appointmentModel.listAppointments(status, range);
    }

    res.status(200).json({ appointments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const approveAppointment = async (req, res) => {
  try {
    const appointment = await appointmentModel.getAppointmentById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (appointment.status !== 'pending') {
      return res.status(400).json({
        error: `Only pending appointments can be approved (current status: ${appointment.status})`,
      });
    }

    if (!(await canManageAppointment(req, appointment))) {
      return res.status(403).json({ error: 'You do not have permission to approve this appointment' });
    }

    const updated = await db.withTransaction(async (client) => {
      const row = await appointmentModel.updateAppointmentStatus(appointment.id, 'scheduled', client);
      await adminModel.createAuditLog({
        action: 'appointment_approved',
        appointment_id: appointment.id,
        old_status: appointment.status,
        new_status: 'scheduled',
        performed_by: req.user.id,
      }, client);
      return row;
    });
    res.status(200).json({ message: 'Appointment approved', appointment: updated });
  } catch (error) {
    if (error.code === '22P02') {
      return res.status(400).json({ error: 'Invalid ID format provided' });
    }
    res.status(500).json({ error: error.message });
  }
};

const rejectAppointment = async (req, res) => {
  try {
    const appointment = await appointmentModel.getAppointmentById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (appointment.status !== 'pending') {
      return res.status(400).json({
        error: `Only pending appointments can be rejected (current status: ${appointment.status})`,
      });
    }

    if (!(await canManageAppointment(req, appointment))) {
      return res.status(403).json({ error: 'You do not have permission to reject this appointment' });
    }

    const updated = await db.withTransaction(async (client) => {
      const row = await appointmentModel.updateAppointmentStatus(appointment.id, 'cancelled', client);
      await adminModel.createAuditLog({
        action: 'appointment_rejected',
        appointment_id: appointment.id,
        old_status: appointment.status,
        new_status: 'cancelled',
        performed_by: req.user.id,
      }, client);
      if (appointment.slot_id) {
        await availabilityModel.setSlotStatus(appointment.slot_id, 'open', client);
      }
      return row;
    });
    res.status(200).json({ message: 'Appointment rejected', appointment: updated });
  } catch (error) {
    if (error.code === '22P02') {
      return res.status(400).json({ error: 'Invalid ID format provided' });
    }
    res.status(500).json({ error: error.message });
  }
};

const cancelAppointment = async (req, res) => {
  try {
    const appointment = await appointmentModel.getAppointmentById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const apptDate = new Date(appointment.appointment_date);
    const minHours = Number(process.env.CANCEL_MIN_HOURS) || 24;
    const hoursUntil = (apptDate.getTime() - Date.now()) / 3600000;

    if (req.user.role === 'patient') {
      const patient = await appointmentModel.getPatientByUserId(req.user.id);
      if (!patient || Number(appointment.patient_id) !== Number(patient.id)) {
        return res.status(403).json({ error: 'You do not have permission to cancel this appointment' });
      }

      if (hoursUntil < minHours) {
        return res.status(400).json({
          error: `Cancellations within ${minHours} hours require calling the clinic`,
        });
      }

      const updated = await db.withTransaction(async (client) => {
        const row = await appointmentModel.updateAppointmentStatus(appointment.id, 'cancelled', client);
        await adminModel.createAuditLog({
          action: 'appointment_cancelled',
          appointment_id: appointment.id,
          old_status: appointment.status,
          new_status: 'cancelled',
          performed_by: req.user.id,
        }, client);
        if (appointment.slot_id) {
          await availabilityModel.setSlotStatus(appointment.slot_id, 'open', client);
        }
        return row;
      });
      return res.status(200).json({ message: 'Appointment cancelled', appointment: updated });
    }

    if (!(await canManageAppointment(req, appointment))) {
      return res.status(403).json({ error: 'You do not have permission to cancel this appointment' });
    }

    const updated = await db.withTransaction(async (client) => {
      const row = await appointmentModel.updateAppointmentStatus(appointment.id, 'cancelled', client);
      await adminModel.createAuditLog({
        action: 'appointment_cancelled',
        appointment_id: appointment.id,
        old_status: appointment.status,
        new_status: 'cancelled',
        performed_by: req.user.id,
      }, client);
      if (appointment.slot_id) {
        await availabilityModel.setSlotStatus(appointment.slot_id, 'open', client);
      }
      return row;
    });
    res.status(200).json({ message: 'Appointment cancelled', appointment: updated });
  } catch (error) {
    if (error.code === '22P02') {
      return res.status(400).json({ error: 'Invalid ID format provided' });
    }
    res.status(500).json({ error: error.message });
  }
};

const bookingOptions = async (req, res) => {
  try {
    const role = normalizeRole(req.user.role);

    // Staff see only their assigned clinic and its doctors — nothing more.
    if (role === 'doctor' || role === 'receptionist') {
      const profile = role === 'doctor'
        ? await appointmentModel.getDoctorByUserId(req.user.id)
        : await appointmentModel.getReceptionistByUserId(req.user.id);
      const clinicIds = [];
      if (profile && profile.clinic_id) clinicIds.push(Number(profile.clinic_id));
      // Canonical fallback: users.clinic_id is set on invite and is immutable.
      if (!clinicIds.length && req.user.clinic_id) clinicIds.push(Number(req.user.clinic_id));
      const clinics = await appointmentModel.listClinicsByIds(clinicIds);
      const doctors = await appointmentModel.listDoctorsByClinicIds(clinicIds);
      return res.status(200).json({ clinics, doctors });
    }

    // Owners see only their own clinics and those clinics' doctors.
    if (role === 'clinic_owner') {
      const owned = await ownerModel.getOwnerClinicIds(req.user.id);
      const clinics = await appointmentModel.listClinicsByIds(owned);
      const doctors = await appointmentModel.listDoctorsByClinicIds(owned);
      return res.status(200).json({ clinics, doctors });
    }

    // Patients need every clinic/doctor to book; admins need the full overview.
    const clinics = await appointmentModel.listClinics();
    const doctors = await appointmentModel.listDoctors();
    res.status(200).json({ clinics, doctors });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  bookAppointment,
  listMyAppointments,
  listAppointments,
  approveAppointment,
  rejectAppointment,
  cancelAppointment,
  bookingOptions,
};
