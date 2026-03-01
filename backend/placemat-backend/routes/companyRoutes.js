/**
 * PLACEMAT — routes/companyRoutes.js
 */

const express  = require('express');
const router   = express.Router();
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');
const { sanitizeInputs } = require('../middlewares/validate');
const { logoUpload, offerUpload } = require('../middlewares/upload');

const authCtrl    = require('../controllers/companyAuthController');
const companyCtrl = require('../controllers/companyController');

// ─── AUTH (public) ────────────────────────────────────────────
router.post('/auth/login',    sanitizeInputs, authCtrl.login);
router.post('/auth/register', sanitizeInputs, authCtrl.register);

// ─── PROTECTED ────────────────────────────────────────────────
router.use(authenticateToken, authorizeRoles('company'));

// Profile
router.get('/profile',              companyCtrl.getProfile);
router.put('/profile',              sanitizeInputs, companyCtrl.updateProfile);
router.post('/profile/logo',        logoUpload.single('logo'), companyCtrl.uploadLogo);

// Drives
router.get('/drives',               companyCtrl.getMyDrives);
router.get('/drives/:id',           companyCtrl.getDriveById);
router.post('/drives',              sanitizeInputs, companyCtrl.createDrive);
router.put('/drives/:id',           sanitizeInputs, companyCtrl.updateDrive);
router.patch('/drives/:id/close',   companyCtrl.closeDrive);

// Applicants
router.get('/drives/:id/applicants',                  companyCtrl.getDriveApplicants);
router.patch('/applications/:id/status',              sanitizeInputs, companyCtrl.updateApplicationStatus);
router.patch('/applications/bulk',                    sanitizeInputs, companyCtrl.bulkUpdateApplications);

// Interviews
router.post('/interviews',          sanitizeInputs, companyCtrl.scheduleInterview);
router.patch('/interviews/:id',     sanitizeInputs, companyCtrl.updateInterviewResult);

// Offers
router.post('/offers', offerUpload.single('offer_letter'), companyCtrl.issueOffer);

// Reports
router.get('/reports',              companyCtrl.getReports);

// Queries
router.post('/queries',             sanitizeInputs, companyCtrl.submitQuery);
router.get('/queries',              companyCtrl.getMyQueries);

// Notifications
router.get('/notifications',        companyCtrl.getMyNotifications);

module.exports = router;
