const ownerModel = require('../models/ownerModel');

const clinicIdSources = (req) => [
  req.params.clinicId,
  req.params.clinic_id,
  req.body && req.body.clinic_id,
  req.query.clinic_id,
];

const requireClinicScope = async (req, res, next) => {
  try {
    const raw = clinicIdSources(req).find((v) => v !== undefined && v !== null && v !== '');
    const clinicId = Number(raw);

    if (!Number.isInteger(clinicId) || clinicId <= 0) {
      return res.status(400).json({ error: 'A valid clinic_id is required' });
    }

    const owned = await ownerModel.getOwnerClinicIds(req.user.id);
    if (!owned.includes(clinicId)) {
      return res.status(403).json({ error: 'This clinic is not one of your clinics' });
    }

    req.clinicId = clinicId;
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { requireClinicScope };
