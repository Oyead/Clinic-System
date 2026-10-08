const adminModel = require('../models/adminModel')
const { hashPassword } = require('../utils/password');

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
  
    const user = await adminModel.createUser({ 
      email, 
      password_hash: hashPassword(password), 
      role 
    });

    res.status(201).json({ 
      message: 'User created successfully', 
      user 
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

module.exports = {
  addClinic,
  addDoctor,
  assignDoctor,
  addUser,
};