/**
 * PLACEMAT — controllers/studentController.js
 * Student dashboard operations
 */

const { getDb } = require('../database/db');
const path = require('path');
const fs   = require('fs');

// ─── PROFILE ──────────────────────────────────────────────────

function getProfile(req, res) {
  try {
    const db      = getDb();
    const student = db.prepare(`
      SELECT s.*, c.name as placed_company_name
      FROM students s
      LEFT JOIN companies c ON c.id = s.placed_company_id
      WHERE s.id = ?
    `).get(req.user.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });
    delete student.password_hash;
    return res.json({ success: true, data: { student } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function updateProfile(req, res) {
  try {
    const { name, phone, skills } = req.body;
    const db = getDb();
    db.prepare('UPDATE students SET name=?, phone=?, skills=?, updated_at=? WHERE id=?')
      .run(name, phone||null, JSON.stringify(skills||[]), new Date().toISOString(), req.user.id);
    return res.json({ success: true, message: 'Profile updated.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function uploadResume(req, res) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
    const db = getDb();

    // Delete old resume
    const existing = db.prepare('SELECT resume_path FROM students WHERE id=?').get(req.user.id);
    if (existing?.resume_path && fs.existsSync(existing.resume_path)) {
      fs.unlinkSync(existing.resume_path);
    }

    db.prepare('UPDATE students SET resume_path=?, resume_verified=0, updated_at=? WHERE id=?')
      .run(req.file.path, new Date().toISOString(), req.user.id);

    return res.json({ success: true, message: 'Resume uploaded.', resume_path: req.file.path });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── JOB DRIVES ───────────────────────────────────────────────

function getAvailableDrives(req, res) {
  try {
    const db      = getDb();
    const student = db.prepare('SELECT * FROM students WHERE id=?').get(req.user.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });

    if (student.is_placed) {
      return res.json({ success: true, data: { drives: [], message: 'You are already placed.' } });
    }

    const drives = db.prepare(`
      SELECT jd.*, c.name as company_name, c.logo_path, c.industry,
        CASE WHEN a.id IS NOT NULL THEN 1 ELSE 0 END as already_applied,
        a.status as application_status
      FROM job_drives jd
      JOIN companies c ON c.id = jd.company_id
      LEFT JOIN applications a ON a.drive_id = jd.id AND a.student_id = ?
      WHERE jd.status = 'active' AND c.approval_status = 'approved'
      ORDER BY jd.created_at DESC
    `).all(student.id);

    // Filter eligible drives
    const eligible = drives.filter(d => {
      const branches = JSON.parse(d.eligible_branches || '[]');
      const years    = JSON.parse(d.eligible_years    || '[]');
      if (branches.length > 0 && !branches.includes(student.branch)) return false;
      if (years.length > 0    && !years.includes(student.year))       return false;
      if (student.cgpa < d.min_cgpa) return false;
      return true;
    });

    return res.json({ success: true, data: { drives: eligible } });
  } catch (err) {
    console.error('Get drives error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function applyToDrive(req, res) {
  try {
    const { drive_id } = req.body;
    if (!drive_id) return res.status(400).json({ success: false, message: 'drive_id required.' });

    const db      = getDb();
    const student = db.prepare('SELECT * FROM students WHERE id=?').get(req.user.id);

    if (student.is_placed) {
      return res.status(403).json({ success: false, message: 'You are already placed and cannot apply.' });
    }
    if (student.is_blocked) {
      return res.status(403).json({ success: false, message: 'Your account is blocked.' });
    }

    const drive = db.prepare('SELECT * FROM job_drives WHERE id=? AND status="active"').get(drive_id);
    if (!drive) return res.status(404).json({ success: false, message: 'Drive not found or not active.' });

    // Eligibility check
    const branches = JSON.parse(drive.eligible_branches || '[]');
    const years    = JSON.parse(drive.eligible_years    || '[]');
    if (branches.length > 0 && !branches.includes(student.branch)) {
      return res.status(403).json({ success: false, message: 'You are not eligible for this drive (branch).' });
    }
    if (years.length > 0 && !years.includes(student.year)) {
      return res.status(403).json({ success: false, message: 'You are not eligible for this drive (year).' });
    }
    if (student.cgpa < drive.min_cgpa) {
      return res.status(403).json({ success: false, message: `Minimum CGPA required: ${drive.min_cgpa}` });
    }

    // Check deadline
    if (drive.application_deadline && new Date() > new Date(drive.application_deadline)) {
      return res.status(400).json({ success: false, message: 'Application deadline has passed.' });
    }

    // Check duplicate
    const existing = db.prepare('SELECT id FROM applications WHERE student_id=? AND drive_id=?').get(student.id, drive_id);
    if (existing) return res.status(409).json({ success: false, message: 'You have already applied to this drive.' });

    db.prepare('INSERT INTO applications (student_id, drive_id) VALUES (?,?)').run(student.id, drive_id);

    return res.status(201).json({ success: true, message: 'Application submitted successfully!' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function getMyApplications(req, res) {
  try {
    const db = getDb();
    const applications = db.prepare(`
      SELECT a.id, a.status, a.applied_at, a.notes,
             jd.id as drive_id, jd.title, jd.job_type, jd.package_min, jd.package_max,
             jd.drive_date, jd.location, jd.status as drive_status,
             c.name as company_name, c.logo_path, c.industry
      FROM applications a
      JOIN job_drives jd ON jd.id = a.drive_id
      JOIN companies c ON c.id = jd.company_id
      WHERE a.student_id = ?
      ORDER BY a.applied_at DESC
    `).all(req.user.id);
    return res.json({ success: true, data: { applications } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function getMyInterviews(req, res) {
  try {
    const db = getDb();
    const interviews = db.prepare(`
      SELECT i.*, a.drive_id, jd.title as drive_title, c.name as company_name
      FROM interviews i
      JOIN applications a ON a.id = i.application_id
      JOIN job_drives jd ON jd.id = a.drive_id
      JOIN companies c ON c.id = jd.company_id
      WHERE a.student_id = ?
      ORDER BY i.scheduled_at ASC
    `).all(req.user.id);
    return res.json({ success: true, data: { interviews } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function getMyOffer(req, res) {
  try {
    const db    = getDb();
    const offer = db.prepare(`
      SELECT o.*, c.name as company_name, jd.title as drive_title
      FROM offers o
      JOIN companies c ON c.id = o.company_id
      JOIN job_drives jd ON jd.id = o.drive_id
      WHERE o.student_id = ?
      ORDER BY o.issued_at DESC
      LIMIT 1
    `).get(req.user.id);
    return res.json({ success: true, data: { offer: offer || null } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function respondToOffer(req, res) {
  try {
    const { offer_id, response } = req.body;
    if (!['accepted', 'declined'].includes(response)) {
      return res.status(400).json({ success: false, message: 'Response must be "accepted" or "declined".' });
    }

    const db    = getDb();
    const offer = db.prepare('SELECT * FROM offers WHERE id=? AND student_id=?').get(offer_id, req.user.id);
    if (!offer) return res.status(404).json({ success: false, message: 'Offer not found.' });

    db.prepare('UPDATE offers SET status=?, responded_at=? WHERE id=?')
      .run(response, new Date().toISOString(), offer_id);

    if (response === 'accepted') {
      // Mark student as placed
      db.prepare(`
        UPDATE students SET is_placed=1, placed_company_id=?, placement_package=?, updated_at=?
        WHERE id=?
      `).run(offer.company_id, offer.package, new Date().toISOString(), req.user.id);
    }

    return res.json({ success: true, message: `Offer ${response}.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function getMyNotifications(req, res) {
  try {
    const db      = getDb();
    const student = db.prepare('SELECT branch, year FROM students WHERE id=?').get(req.user.id);
    const notifications = db.prepare(`
      SELECT * FROM notifications
      WHERE (target_role='all' OR target_role='student')
        AND (target_id IS NULL OR target_id = ?)
        AND (target_branch IS NULL OR target_branch = ?)
        AND (target_year IS NULL OR target_year = ?)
      ORDER BY created_at DESC
      LIMIT 50
    `).all(req.user.id, student?.branch, student?.year);
    return res.json({ success: true, data: { notifications } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function submitQuery(req, res) {
  try {
    const { subject, message } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ success: false, message: 'Subject and message required.' });
    }
    const db = getDb();
    db.prepare('INSERT INTO queries (sender_id, sender_role, subject, message) VALUES (?,?,?,?)')
      .run(req.user.id, 'student', subject, message);
    return res.status(201).json({ success: true, message: 'Query submitted.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function getDashboardStats(req, res) {
  try {
    const db      = getDb();
    const student = db.prepare('SELECT * FROM students WHERE id=?').get(req.user.id);
    delete student.password_hash;

    const applications  = db.prepare('SELECT COUNT(*) as c FROM applications WHERE student_id=?').get(req.user.id).c;
    const interviews    = db.prepare(`
      SELECT COUNT(*) as c FROM interviews i
      JOIN applications a ON a.id = i.application_id
      WHERE a.student_id = ?
    `).get(req.user.id).c;
    const activeDrives  = db.prepare("SELECT COUNT(*) as c FROM job_drives WHERE status='active'").get().c;
    const offer         = db.prepare('SELECT * FROM offers WHERE student_id=? LIMIT 1').get(req.user.id);

    return res.json({
      success: true,
      data: { student, stats: { applications, interviews, activeDrives, hasOffer: !!offer, offer } }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = {
  getProfile, updateProfile, uploadResume,
  getAvailableDrives, applyToDrive,
  getMyApplications, getMyInterviews, getMyOffer, respondToOffer,
  getMyNotifications, submitQuery, getDashboardStats
};
