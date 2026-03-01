/**
 * PLACEMAT — routes/adminRoutes.js
 */

const express  = require('express');
const router   = express.Router();
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');
const { sanitizeInputs } = require('../middlewares/validate');
const { auditLog }       = require('../middlewares/auditLogger');

const authCtrl   = require('../controllers/adminAuthController');
const adminCtrl  = require('../controllers/adminController');
const exportCtrl = require('../utils/exportController');

// ─── AUTH (public) ──────────────────────────────────────────
router.post('/auth/login', sanitizeInputs, authCtrl.login);

// ─── ALL ROUTES BELOW ARE PROTECTED ──────────────────────────
router.use(authenticateToken, authorizeRoles('admin', 'superadmin'));

// Dashboard
router.get('/dashboard', adminCtrl.getDashboardStats);

// ─── COMPANIES ────────────────────────────────────────────────
router.get('/companies',                    adminCtrl.getAllCompanies);
router.get('/companies/:id',                adminCtrl.getCompanyById);
router.patch('/companies/:id/status',       sanitizeInputs, auditLog('COMPANY_STATUS_CHANGED', 'company', r => r.params.id), adminCtrl.updateCompanyStatus);
router.patch('/companies/:id/toggle-active',auditLog('COMPANY_ACTIVE_TOGGLED', 'company', r => r.params.id), adminCtrl.toggleCompanyActive);

// ─── STUDENTS ─────────────────────────────────────────────────
router.get('/students',                       adminCtrl.getAllStudents);
router.get('/students/:id',                   adminCtrl.getStudentById);
router.patch('/students/:id/toggle-block',    auditLog('STUDENT_BLOCK_TOGGLED', 'student', r => r.params.id), adminCtrl.toggleStudentBlock);
router.patch('/students/:id/verify',          sanitizeInputs, adminCtrl.verifyStudentProfile);
router.patch('/students/:id/mark-placed',     sanitizeInputs, auditLog('STUDENT_MARKED_PLACED', 'student', r => r.params.id), adminCtrl.markStudentPlaced);

// ─── JOB DRIVES ───────────────────────────────────────────────
router.get('/drives',                   adminCtrl.getAllDrives);
router.post('/drives',                  sanitizeInputs, auditLog('DRIVE_CREATED', 'job_drive', (r,d) => d.driveId), adminCtrl.createDrive);
router.put('/drives/:id',               sanitizeInputs, adminCtrl.updateDrive);
router.delete('/drives/:id',            auditLog('DRIVE_DELETED', 'job_drive', r => r.params.id), adminCtrl.deleteDrive);
router.patch('/drives/:id/status',      sanitizeInputs, adminCtrl.changeDriveStatus);
router.get('/drives/:drive_id/applicants', adminCtrl.getDriveApplicants);

// ─── APPLICATIONS ─────────────────────────────────────────────
router.patch('/applications/:id/status', sanitizeInputs, adminCtrl.updateApplicationStatus);
router.patch('/applications/bulk',       sanitizeInputs, adminCtrl.bulkUpdateApplications);

// ─── INTERVIEWS ───────────────────────────────────────────────
router.get('/interviews', adminCtrl.getAllInterviews);
router.post('/interviews', sanitizeInputs, adminCtrl.scheduleInterview);

// ─── NOTIFICATIONS ────────────────────────────────────────────
router.get('/notifications',       adminCtrl.getNotifications);
router.post('/notifications',      sanitizeInputs, adminCtrl.sendNotification);

// ─── QUERIES ──────────────────────────────────────────────────
router.get('/queries',             adminCtrl.getAllQueries);
router.patch('/queries/:id/reply', sanitizeInputs, adminCtrl.replyQuery);

// ─── ANALYTICS ────────────────────────────────────────────────
router.get('/analytics', adminCtrl.getAnalytics);

// ─── AUDIT LOGS ───────────────────────────────────────────────
router.get('/audit-logs', adminCtrl.getAuditLogs);

// ─── EXPORTS (CSV) ────────────────────────────────────────────
router.get('/export/students',                     exportCtrl.exportStudents);
router.get('/export/applications',                 exportCtrl.exportApplications);
router.get('/export/placements',                   exportCtrl.exportPlacements);
router.get('/export/drives/:drive_id/applicants',  exportCtrl.exportDriveApplicants);

module.exports = router;
