const adminModel = require('../models/adminModel')
const ownerModel = require('../models/ownerModel')
const { hashPassword } = require('../utils/password');
const db = require('../config/db');

const VALID_ROLES = ['admin', 'doctor', 'receptionist', 'patient', 'owner'];

const parseDuration = (value) => {
  if (value === undefined || value === null || value === '') {
    return { ok: true, duration: undefined };
  }
  const duration = Number(value);
  if (!Number.isInteger(duration) || duration <= 0 || duration > 480) {
    return { ok: false };
  }
  return { ok: true, duration };
};

const addClinic = async(req,res)=>{
    try {
    const { name, phone_number, address, email } = req.body;

    if (!name || !phone_number || !address || !email) {
    return res.status(400).json({
    error: 'All fields (name, phone_number, address, email) are required.'
  });
}
    const clinic = await adminModel.createClinic({ name, phone_number, address, email });
    res.status(201).json({ message: 'Clinic created successfully', clinic });
    } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const addDoctor = async (req, res) => {
  try {
    const { user_id, clinic_id, name, phone_number, specialization } = req.body;
    if (!user_id || !clinic_id || !name || !specialization) {
      return res.status(400).json({
        error: 'user_id, clinic_id, name, and specialization are required'
      });
    }

    const parsed = parseDuration(req.body.duration_minutes);
    if (!parsed.ok) {
      return res.status(400).json({
        error: 'duration_minutes must be an integer between 1 and 480'
      });
    }

    const user = await adminModel.getUserById(user_id);
    if (!user) {
      return res.status(400).json({
        error: 'Referenced user_id does not exist'
      });
    }
    if (user.role !== 'doctor') {
      return res.status(400).json({
        error: "user_id must reference a user with role 'doctor'"
      });
    }

    const doctor = await adminModel.createDoctor({ user_id, clinic_id, name, phone_number, specialization, ...(parsed.duration !== undefined ? { duration_minutes: parsed.duration } : {}) });

    res.status(201).json({
      message: 'Doctor created successfully',
      doctor
    });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(400).json({
        error: 'Referenced user_id or clinic_id does not exist'
      });
    }

    if (error.code === '23502') {
      return res.status(400).json({
        error: 'A required field is missing'
      });
    }

    if (error.code === '23514') {
      return res.status(400).json({
        error: 'duration_minutes must be an integer between 1 and 480'
      });
    }

    res.status(500).json({ error: error.message });
  }
};

const assignDoctor = async (req, res) => {
  try {
    const doctorId = req.params.id;
    const { clinic_id } = req.body;

    if (!clinic_id) {
      return res.status(400).json({ error: 'clinic_id is required in body' });
    }

    const updatedDoctor = await adminModel.assignDoctorToClinic(doctorId, clinic_id);

    if (!updatedDoctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    return res.status(200).json({
      message: 'Doctor assigned to clinic successfully',
      doctor: updatedDoctor
    });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(400).json({ error: 'The provided clinic_id does not exist' });
    }

    if (error.code === '22P02') {
      return res.status(400).json({ error: 'Invalid ID format provided' });
    }

    return res.status(500).json({ error: error.message });
  }
};

const addUser = async (req, res) => {
  try {
    const { password, role } = req.body;
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : req.body.email;

    if (!email || !password || !role) {
      return res.status(400).json({
        error: 'email, password, and role are required.'
      });
    }

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({
        error: `role must be one of: ${VALID_ROLES.join(', ')}`
      });
    }

    if (role === 'patient' && !req.body.name) {
      return res.status(400).json({
        error: 'name is required when creating a patient account (used for the patient profile)'
      });
    }

    if (role === 'doctor' && (!req.body.clinic_id || !req.body.name || !req.body.specialization)) {
      return res.status(400).json({
        error: 'clinic_id, name, and specialization are required when creating a doctor account (used for the doctor profile)'
      });
    }

    let staffDuration;
    if (role === 'doctor') {
      const parsed = parseDuration(req.body.duration_minutes);
      if (!parsed.ok) {
        return res.status(400).json({
          error: 'duration_minutes must be an integer between 1 and 480'
        });
      }
      staffDuration = parsed.duration;
    }

    if (role === 'receptionist' && (!req.body.clinic_id || !req.body.name)) {
      return res.status(400).json({
        error: 'clinic_id and name are required when creating a receptionist account (used for the receptionist profile)'
      });
    }

    if (role === 'owner' && !req.body.clinic_id) {
      return res.status(400).json({
        error: 'clinic_id is required when creating an owner account (links them to their clinic)'
      });
    }

    if ((role === 'doctor' || role === 'receptionist' || role === 'owner') && !(await adminModel.getClinicById(req.body.clinic_id))) {
      return res.status(400).json({
        error: 'The provided clinic_id does not exist'
      });
    }

    const user = await db.withTransaction(async (client) => {
      const created = await adminModel.createUser({
        email,
        password_hash: hashPassword(password),
        role
      }, client);

      let patient = null;
      if (role === 'patient') {
        patient = await adminModel.createPatient({
          user_id: created.id,
          name: req.body.name,
          phone_number: req.body.phone_number || null,
          email,
        }, client);
      }

      let doctor = null;
      if (role === 'doctor') {
        doctor = await adminModel.createDoctor({
          user_id: created.id,
          clinic_id: req.body.clinic_id,
          name: req.body.name,
          phone_number: req.body.phone_number || null,
          specialization: req.body.specialization,
          ...(staffDuration !== undefined ? { duration_minutes: staffDuration } : {}),
        }, client);
      }

      let receptionist = null;
      if (role === 'receptionist') {
        receptionist = await adminModel.createReceptionist({
          user_id: created.id,
          clinic_id: req.body.clinic_id,
          name: req.body.name,
          phone_number: req.body.phone_number || null,
        }, client);
      }

      if (role === 'owner') {
        await ownerModel.assignOwner(created.id, req.body.clinic_id, client);
      }

      await adminModel.createAuditLog({
        action: 'admin_create_user',
        target_user_id: created.id,
        target_email: created.email,
        old_role: null,
        new_role: created.role,
        performed_by: req.user ? req.user.id : null,
        clinic_id: role === 'owner' ? req.body.clinic_id : null,
      }, client);

      return { user: created, patient, doctor, receptionist };
    });

    res.status(201).json({
      message: 'User created successfully',
      ...(user.patient ? { patient: user.patient } : {}),
      ...(user.doctor ? { doctor: user.doctor } : {}),
      ...(user.receptionist ? { receptionist: user.receptionist } : {}),
      user: user.user
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'An account with this email already exists'
      });
    }

    if (error.code === '23502') {
      return res.status(400).json({
        error: 'A required field is missing'
      });
    }

    if (error.code === '22P02') {
      return res.status(400).json({
        error: 'Invalid value provided'
      });
    }

    res.status(500).json({ error: error.message });
  }
};

const addReceptionist = async (req, res) => {
  try {
    const { user_id, clinic_id, name, phone_number } = req.body;
    if (!user_id || !clinic_id || !name) {
      return res.status(400).json({
        error: 'user_id, clinic_id, and name are required'
      });
    }

    const user = await adminModel.getUserById(user_id);
    if (!user) {
      return res.status(400).json({
        error: 'Referenced user_id does not exist'
      });
    }
    if (user.role !== 'receptionist') {
      return res.status(400).json({
        error: "user_id must reference a user with role 'receptionist'"
      });
    }

    const receptionist = await adminModel.createReceptionist({ user_id, clinic_id, name, phone_number });

    res.status(201).json({
      message: 'Receptionist created successfully',
      receptionist
    });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(400).json({
        error: 'Referenced user_id or clinic_id does not exist'
      });
    }

    if (error.code === '23505') {
      return res.status(409).json({
        error: 'This receptionist user is already linked to a clinic'
      });
    }

    if (error.code === '22P02') {
      return res.status(400).json({
        error: 'Invalid value provided'
      });
    }

    res.status(500).json({ error: error.message });
  }
};

const assignReceptionist = async (req, res) => {
  try {
    const receptionistId = req.params.id;
    const { clinic_id } = req.body;

    if (!clinic_id) {
      return res.status(400).json({ error: 'clinic_id is required in body' });
    }

    const updatedReceptionist = await adminModel.assignReceptionistToClinic(receptionistId, clinic_id);

    if (!updatedReceptionist) {
      return res.status(404).json({ error: 'Receptionist not found' });
    }

    return res.status(200).json({
      message: 'Receptionist assigned to clinic successfully',
      receptionist: updatedReceptionist
    });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(400).json({ error: 'The provided clinic_id does not exist' });
    }

    if (error.code === '22P02') {
      return res.status(400).json({ error: 'Invalid ID format provided' });
    }

    return res.status(500).json({ error: error.message });
  }
};

const listPatients = async (req, res) => {
  try {
    const unlinked = req.query.unlinked === 'true';
    const patients = await adminModel.listPatients({ unlinked });
    res.status(200).json({ patients });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const linkPatient = async (req, res) => {
  try {
    const patientId = req.params.id;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required in body' });
    }

    const patient = await adminModel.getPatientById(patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    if (patient.user_id) {
      return res.status(409).json({ error: 'This patient is already linked to a user account' });
    }

    const user = await adminModel.getUserById(user_id);
    if (!user) {
      return res.status(400).json({ error: 'Referenced user_id does not exist' });
    }

    if (user.role !== 'patient') {
      return res.status(400).json({ error: "user_id must reference a user with role 'patient'" });
    }

    const linked = await adminModel.linkPatientToUser(patientId, user_id);

    return res.status(200).json({
      message: 'Patient linked to user account successfully',
      patient: linked
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'This patient or user is already linked elsewhere'
      });
    }

    if (error.code === '22P02') {
      return res.status(400).json({ error: 'Invalid ID format provided' });
    }

    return res.status(500).json({ error: error.message });
  }
};

const listUsers = async (req, res) => {
  try {
    const { role } = req.query;
    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({
        error: `role filter must be one of: ${VALID_ROLES.join(', ')}`,
      });
    }
    const users = await adminModel.listUsers({
      role: role || undefined,
      limit: Math.min(parseInt(req.query.limit, 10) || 100, 500),
      offset: Math.max(parseInt(req.query.offset, 10) || 0, 0),
    });
    res.status(200).json({ users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const targetId = req.params.id;
    const { role: newRole } = req.body;

    if (!newRole) {
      return res.status(400).json({ error: 'role is required in body' });
    }
    if (!VALID_ROLES.includes(newRole)) {
      return res.status(400).json({
        error: `role must be one of: ${VALID_ROLES.join(', ')}`,
      });
    }

    const target = await adminModel.getUserById(targetId);
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (target.role === newRole) {
      return res.status(200).json({ message: 'Role unchanged', user: target });
    }

    const isDemotingAdmin = target.role === 'admin' && newRole !== 'admin';

    if (isDemotingAdmin && String(target.id) === String(req.user.id)) {
      return res.status(403).json({
        error: 'You cannot demote your own admin account. Ask another admin to change your role.',
      });
    }

    if (isDemotingAdmin) {
      const adminCount = await adminModel.countActiveAdmins();
      if (adminCount <= 1) {
        return res.status(403).json({
          error: 'Cannot demote the last remaining active admin.',
        });
      }
    }

    let needsDoctorProfile = false;
    let needsReceptionistProfile = false;
    if (newRole === 'doctor' && !(await adminModel.getDoctorByUserId(target.id))) {
      needsDoctorProfile = true;
    }
    if (newRole === 'receptionist' && !(await adminModel.getReceptionistByUserId(target.id))) {
      needsReceptionistProfile = true;
    }
    if (needsDoctorProfile && (!req.body.clinic_id || !req.body.name || !req.body.specialization)) {
      return res.status(400).json({
        error: 'clinic_id, name, and specialization are required when promoting to doctor (used for the doctor profile)'
      });
    }
    let promotionDuration;
    if (needsDoctorProfile) {
      const parsed = parseDuration(req.body.duration_minutes);
      if (!parsed.ok) {
        return res.status(400).json({
          error: 'duration_minutes must be an integer between 1 and 480'
        });
      }
      promotionDuration = parsed.duration;
    }
    if (needsReceptionistProfile && (!req.body.clinic_id || !req.body.name)) {
      return res.status(400).json({
        error: 'clinic_id and name are required when promoting to receptionist (used for the receptionist profile)'
      });
    }
    if ((needsDoctorProfile || needsReceptionistProfile) && !(await adminModel.getClinicById(req.body.clinic_id))) {
      return res.status(400).json({
        error: 'The provided clinic_id does not exist'
      });
    }

    let assignOwnerClinic = null;
    if (newRole === 'owner') {
      if (!req.body.clinic_id) {
        return res.status(400).json({
          error: 'clinic_id is required when promoting to owner (links them to their clinic)'
        });
      }
      if (!(await adminModel.getClinicById(req.body.clinic_id))) {
        return res.status(400).json({
          error: 'The provided clinic_id does not exist'
        });
      }
      assignOwnerClinic = req.body.clinic_id;
    }

    const result = await db.withTransaction(async (client) => {
      const row = await adminModel.updateUserRole(target.id, newRole, client);

      let doctor = null;
      if (needsDoctorProfile) {
        doctor = await adminModel.createDoctor({
          user_id: target.id,
          clinic_id: req.body.clinic_id,
          name: req.body.name,
          phone_number: req.body.phone_number || null,
          specialization: req.body.specialization,
          ...(promotionDuration !== undefined ? { duration_minutes: promotionDuration } : {}),
        }, client);
      }

      let receptionist = null;
      if (needsReceptionistProfile) {
        receptionist = await adminModel.createReceptionist({
          user_id: target.id,
          clinic_id: req.body.clinic_id,
          name: req.body.name,
          phone_number: req.body.phone_number || null,
        }, client);
      }

      await adminModel.createAuditLog({
        action: 'admin_role_change',
        target_user_id: target.id,
        target_email: target.email,
        old_role: target.role,
        new_role: newRole,
        performed_by: req.user.id,
        clinic_id: assignOwnerClinic,
      }, client);

      if (assignOwnerClinic) {
        await ownerModel.assignOwner(target.id, assignOwnerClinic, client);
      }
      if (target.role === 'owner' && newRole !== 'owner') {
        await ownerModel.removeAllOwnerClinics(target.id, client);
      }

      return { user: row, doctor, receptionist };
    });

    return res.status(200).json({
      message: 'User role updated successfully',
      ...(result.doctor ? { doctor: result.doctor } : {}),
      ...(result.receptionist ? { receptionist: result.receptionist } : {}),
      user: result.user,
    });
  } catch (error) {
    if (error.code === '22P02') {
      return res.status(400).json({ error: 'Invalid ID format provided' });
    }
    return res.status(500).json({ error: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const targetId = req.params.id;
    const target = await adminModel.getUserById(targetId);
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (String(target.id) === String(req.user.id)) {
      return res.status(403).json({
        error: 'You cannot delete your own admin account.',
      });
    }

    if (target.role === 'admin' && target.is_active) {
      const adminCount = await adminModel.countActiveAdmins();
      if (adminCount <= 1) {
        return res.status(403).json({
          error: 'Cannot delete the last remaining active admin.',
        });
      }
    }

    const deactivated = await db.withTransaction(async (client) => {
      const row = await adminModel.deactivateUser(target.id, client);
      await adminModel.createAuditLog({
        action: 'admin_delete_user',
        target_user_id: target.id,
        target_email: target.email,
        old_role: target.role,
        new_role: null,
        performed_by: req.user.id,
      }, client);
      return row;
    });

    return res.status(200).json({
      message: 'User deactivated successfully',
      user: deactivated,
    });
  } catch (error) {
    if (error.code === '22P02') {
      return res.status(400).json({ error: 'Invalid ID format provided' });
    }
    return res.status(500).json({ error: error.message });
  }
};

const listAuditLogs = async (req, res) => {
  try {
    const logs = await adminModel.listAuditLogs({
      limit: Math.min(parseInt(req.query.limit, 10) || 100, 500),
      offset: Math.max(parseInt(req.query.offset, 10) || 0, 0),
    });
    res.status(200).json({ audit_logs: logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  addClinic,
  addDoctor,
  assignDoctor,
  addUser,
  addReceptionist,
  assignReceptionist,
  listPatients,
  linkPatient,
  listUsers,
  updateUserRole,
  deleteUser,
  listAuditLogs,
};
