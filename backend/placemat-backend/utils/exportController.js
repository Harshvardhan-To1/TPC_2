/**
 * PLACEMAT — utils/exportController.js
 * CSV export endpoints
 */

const { getDb } = require('../database/db');
const { sendCSV } = require('./csvExport');

function exportStudents(req, res) {
  try {
    const db       = getDb();
    const students = db.prepare(`
      SELECT id, name, roll_number, email, branch, year, cgpa,
             is_placed, placement_package, is_blocked, created_at
      FROM students WHERE is_active=1
    `).all();
    sendCSV(res, students, 'students.csv');
  } catch (err) {
    res.status(500).json({ success: false, message: 'Export failed.' });
  }
}

function exportApplications(req, res) {
  try {
    const db   = getDb();
    const rows = db.prepare(`
      SELECT a.id, s.name as student_name, s.roll_number, s.branch, s.cgpa,
             jd.title as drive_title, c.name as company_name,
             a.status, a.applied_at
      FROM applications a
      JOIN students s ON s.id = a.student_id
      JOIN job_drives jd ON jd.id = a.drive_id
      JOIN companies c ON c.id = jd.company_id
      ORDER BY a.applied_at DESC
    `).all();
    sendCSV(res, rows, 'applications.csv');
  } catch (err) {
    res.status(500).json({ success: false, message: 'Export failed.' });
  }
}

function exportPlacements(req, res) {
  try {
    const db   = getDb();
    const rows = db.prepare(`
      SELECT s.name, s.roll_number, s.branch, s.cgpa,
             c.name as company, o.package, o.status as offer_status, o.issued_at
      FROM offers o
      JOIN students s ON s.id = o.student_id
      JOIN companies c ON c.id = o.company_id
      ORDER BY o.issued_at DESC
    `).all();
    sendCSV(res, rows, 'placements.csv');
  } catch (err) {
    res.status(500).json({ success: false, message: 'Export failed.' });
  }
}

function exportDriveApplicants(req, res) {
  try {
    const db   = getDb();
    const rows = db.prepare(`
      SELECT s.name, s.roll_number, s.email, s.branch, s.year, s.cgpa, s.phone,
             a.status, a.applied_at
      FROM applications a
      JOIN students s ON s.id = a.student_id
      WHERE a.drive_id = ?
      ORDER BY s.cgpa DESC
    `).all(req.params.drive_id);
    sendCSV(res, rows, `drive_${req.params.drive_id}_applicants.csv`);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Export failed.' });
  }
}

module.exports = { exportStudents, exportApplications, exportPlacements, exportDriveApplicants };
