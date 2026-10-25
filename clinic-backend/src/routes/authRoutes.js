const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

router.post('/signup', authController.signup);
router.patch('/profile', requireAuth, authController.updateProfile);
router.post('/signup-clinic', authController.signupClinic);
router.post('/accept-invite', authController.acceptInvite);
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);
router.post('/signout', authController.signout);

module.exports = router;
