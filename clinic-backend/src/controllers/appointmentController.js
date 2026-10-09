const appointmentModel = require('../models/appointmentModel');

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
  return false;
};

const bookAppointment = async (req, res) => {
  try {
    const { clinic_id, doctor_id, appointment_date, reason } = req.body;

    if (!clinic_id || !doctor_id || !appointment_date) {
      return res.status(400).json({ error: 'clinic_id, doctor_id, and appointment_date are required' });
    }

    if (!isValidPositiveId(clinic_id) || !isValidPositiveId(doctor_id)) {
      return res.status(400).json({ error: 'clinic_id and doctor_id must be positive integers' });
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

    const conflict = await appointmentModel.getAppointmentConflict(doctor_id, date.toISOString());
    if (conflict) {
      return res.status(409).json({ error: 'The doctor already has a pending or scheduled appointment at this time' });
    }

    const appointment = await appointmentModel.createAppointment({
      clinicId: clinic_id,
      patientId: patient.id,
      doctorId: doctor_id,
      appointmentDate: date,
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

    if (error.code === '23505') {
      return res.status(409).json({ error: 'The doctor already has a pending or scheduled appointment at this time' });
    }

    if (error.code === '22P02') {
      return res.status(400).json({ error: 'Invalid value provided' });
    }

    res.status(500).json({ error: error.message });
  }
};

const listMyAppointments = async (req, res) => {
  try {
    const patient = await appointmentModel.getPatientByUserId(req.user.id);
    if (!patient) {
      return res.status(200).json({ appointments: [] });
    }
    const appointments = await appointmentModel.listAppointmentsByPatientId(patient.id);
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

    let appointments;
    if (req.user.role === 'doctor') {
      const doctor = await appointmentModel.getDoctorByUserId(req.user.id);
      appointments = doctor
        ? await appointmentModel.listAppointmentsByDoctorId(doctor.id, status)
        : [];
    } else if (req.user.role === 'receptionist') {
      const receptionist = await appointmentModel.getReceptionistByUserId(req.user.id);
      appointments = receptionist
        ? await appointmentModel.listAppointmentsByClinicId(receptionist.clinic_id, status)
        : [];
    } else {
      appointments = await appointmentModel.listAppointments(status);
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

    const updated = await appointmentModel.updateAppointmentStatus(appointment.id, 'scheduled');
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

    const updated = await appointmentModel.updateAppointmentStatus(appointment.id, 'cancelled');
    res.status(200).json({ message: 'Appointment rejected', appointment: updated });
  } catch (error) {
    if (error.code === '22P02') {
      return res.status(400).json({ error: 'Invalid ID format provided' });
    }
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  bookAppointment,
  listMyAppointments,
  listAppointments,
  approveAppointment,
  rejectAppointment,
};