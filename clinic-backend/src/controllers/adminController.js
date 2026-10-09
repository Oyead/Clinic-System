const adminModel = require('../models/adminModel')
const { hashPassword } = require('../utils/password');
const db = require('../config/db');

const VALID_ROLES = ['admin', 'doctor', 'receptionist', 'patient'];

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

    const doctor = await adminModel.createDoctor({ user_id, clinic_id, name, phone_number, specialization });
    
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
    const { email, password, role } = req.body;

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

      return { user: created, patient };
    });

    res.status(201).json({ 
      message: 'User created successfully',
      ...(user.patient ? { patient: user.patient } : {}),
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

module.exports = {
  addClinic,
  addDoctor,
  assignDoctor,
  addUser,
  addReceptionist,
  assignReceptionist,
  listPatients,
  linkPatient,
};