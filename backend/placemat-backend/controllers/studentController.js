/**
 * PLACEMAT — controllers/studentController.js
 * Student dashboard operations
 */

const { getDb } = require('../database/db');
const fs = require('fs');

function parseJsonArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeYearValues(value) {
  return parseJsonArray(value).map(v => Number.parseInt(v, 10)).filter(Number.isFinite);
}

function includesStudentYear(eligibleYears, studentYear) {
  if (!eligibleYears.length) return true;
  return eligibleYears.includes(Number.parseInt(studentYear, 10));
}

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
    const { name, phone, skills, branch, year, cgpa } = req.body;
    const db = getDb();

    const current = db.prepare('SELECT * FROM students WHERE id=?').get(req.user.id);
    if (!current) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Name cannot be empty.' });
    }
    if (cgpa !== undefined) {
      const cgpaValue = Number.parseFloat(cgpa);
      if (!Number.isFinite(cgpaValue) || cgpaValue < 0 || cgpaValue > 10) {
        return res.status(400).json({ success: false, message: 'CGPA must be between 0 and 10.' });
      }
    }
    if (year !== undefined) {
      const yearValue = Number.parseInt(year, 10);
      if (!Number.isFinite(yearValue) || yearValue < 1 || yearValue > 10) {
        return res.status(400).json({ success: false, message: 'Invalid year value.' });
      }
    }
    if (skills !== undefined && !Array.isArray(skills)) {
      return res.status(400).json({ success: false, message: 'skills must be an array.' });
    }

    const nextName = name !== undefined ? String(name).trim() : current.name;
    const nextPhone = phone !== undefined ? (String(phone).trim() || null) : current.phone;
    const nextSkills = skills !== undefined ? JSON.stringify(skills) : current.skills;
    const nextBranch = branch !== undefined ? String(branch).trim() || current.branch : current.branch;
    const nextYear = year !== undefined ? Number.parseInt(year, 10) : current.year;
    const nextCgpa = cgpa !== undefined ? Number.parseFloat(cgpa) : current.cgpa;

    db.prepare(`
      UPDATE students
      SET name=?, phone=?, skills=?, branch=?, year=?, cgpa=?, updated_at=?
      WHERE id=?
    `).run(
      nextName,
      nextPhone,
      nextSkills,
      nextBranch,
      nextYear,
      nextCgpa,
      new Date().toISOString(),
      req.user.id
    );

    return res.json({ success: true, message: 'Profile updated.' });
  } catch (err) {
    console.error('Apply to drive error:', err);
    return res.status(500).json({ success: false, message: 'Apply catch error.' });
  }
}

function uploadResume(req, res) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
    const db = getDb();

    // Delete old resume
    const existing = db.prepare('SELECT resume_path FROM students WHERE id=?').get(req.user.id);
    if (existing?.resume_path && fs.existsSync(existing.resume_path)) {
      try { fs.unlinkSync(existing.resume_path); } catch {}
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
      const branches = parseJsonArray(d.eligible_branches);
      const years = normalizeYearValues(d.eligible_years);
      if (branches.length > 0 && !branches.includes(student.branch)) return false;
      if (!includesStudentYear(years, student.year)) return false;
      if (student.cgpa < d.min_cgpa) return false;
      return true;
    }).map(d => ({ ...d, eligible: true }));

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

    const drive = db.prepare("SELECT * FROM job_drives WHERE id=? AND status='active'").get(drive_id);
    if (!drive) return res.status(404).json({ success: false, message: 'Drive not found or not active.' });

    // Eligibility check
    const branches = parseJsonArray(drive.eligible_branches);
    const years = normalizeYearValues(drive.eligible_years);
    if (branches.length > 0 && !branches.includes(student.branch)) {
      return res.status(403).json({ success: false, message: 'You are not eligible for this drive (branch).' });
    }
    if (!includesStudentYear(years, student.year)) {
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
    console.error('Apply to drive error:', err);
    return res.status(500).json({ success: false, message: 'Failed to submit application.' });
  }
}

function getMyApplications(req, res) {
  try {
    const db = getDb();
    const applications = db.prepare(`
      SELECT a.id, a.status, a.applied_at, a.notes,
             jd.id as drive_id, jd.title as drive_title, jd.job_type, jd.package_min, jd.package_max,
             jd.drive_date, jd.location, jd.status as drive_status,
             c.name as company_name, c.logo_path, c.industry,
             o.offer_letter as offer_letter_path
      FROM applications a
      JOIN job_drives jd ON jd.id = a.drive_id
      JOIN companies c ON c.id = jd.company_id
      LEFT JOIN offers o ON o.application_id = a.id
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
      SELECT i.*, a.drive_id, a.status as application_status, jd.title as drive_title, c.name as company_name
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
      SELECT o.*, o.offer_letter as offer_letter_path, c.name as company_name, jd.title as drive_title
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
    const normalizedResponse = String(response || '').toLowerCase() === 'rejected'
      ? 'declined'
      : String(response || '').toLowerCase();

    if (!['accepted', 'declined'].includes(normalizedResponse)) {
      return res.status(400).json({ success: false, message: 'Response must be "accepted" or "declined".' });
    }

    const db = getDb();
    const offer = offer_id
      ? db.prepare('SELECT * FROM offers WHERE id=? AND student_id=?').get(offer_id, req.user.id)
      : db.prepare("SELECT * FROM offers WHERE student_id=? AND status='pending' ORDER BY issued_at DESC LIMIT 1").get(req.user.id);

    if (!offer) return res.status(404).json({ success: false, message: 'Offer not found.' });
    if (offer.status !== 'pending') {
      return res.status(409).json({ success: false, message: `Offer is already ${offer.status}.` });
    }

    db.prepare('UPDATE offers SET status=?, responded_at=? WHERE id=?')
      .run(normalizedResponse, new Date().toISOString(), offer.id);

    if (normalizedResponse === 'accepted') {
      // Mark student as placed
      db.prepare(`
        UPDATE students SET is_placed=1, placed_company_id=?, placement_package=?, updated_at=?
        WHERE id=?
      `).run(offer.company_id, offer.package, new Date().toISOString(), req.user.id);
    }

    return res.json({ success: true, message: `Offer ${normalizedResponse}.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function getMyNotifications(req, res) {
  try {
    const db      = getDb();
    const student = db.prepare('SELECT branch, year FROM students WHERE id=?').get(req.user.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });

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

function getMyQueries(req, res) {
  try {
    const db = getDb();
    const queries = db.prepare(`
      SELECT * FROM queries
      WHERE sender_id=? AND sender_role='student'
      ORDER BY created_at DESC
    `).all(req.user.id);

    return res.json({ success: true, data: { queries } });
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
    const db = getDb();
    const student = db.prepare('SELECT * FROM students WHERE id=?').get(req.user.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });
    delete student.password_hash;

    const applications = db.prepare('SELECT COUNT(*) as c FROM applications WHERE student_id=?').get(req.user.id).c;
    const interviews = db.prepare(`
      SELECT COUNT(*) as c FROM interviews i
      JOIN applications a ON a.id = i.application_id
      WHERE a.student_id = ?
    `).get(req.user.id).c;
    const activeDrives = db.prepare(`
      SELECT COUNT(*) as c
      FROM job_drives jd
      JOIN companies c ON c.id = jd.company_id
      WHERE jd.status='active' AND c.approval_status='approved'
    `).get().c;
    const offer = db.prepare('SELECT * FROM offers WHERE student_id=? ORDER BY issued_at DESC LIMIT 1').get(req.user.id);

    return res.json({
      success: true,
      data: {
        // New normalized shape
        profile: student,
        stats: { applications, interviews, activeDrives, hasOffer: !!offer, offer: offer || null },
        // Backward compatibility for existing frontend logic
        student,
        totalApplications: applications,
        upcomingInterviews: interviews,
        hasOffer: !!offer,
        offer: offer || null
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function getPlacedStudentsPublic(req, res) {
  try {
    const db = getDb();
    const students = db.prepare(`
      SELECT s.name, s.branch, s.roll_number as roll, c.name as company, o.package, s.skills, o.drive_id
      FROM offers o
      JOIN students s ON s.id = o.student_id
      JOIN companies c ON c.id = o.company_id
      WHERE o.status = 'accepted'
      ORDER BY o.package DESC, o.issued_at DESC
      LIMIT 500
    `).all().map(row => ({
      ...row,
      skills: parseJsonArray(row.skills)
    }));

    const placedStudents = students.length;
    const totalPackage = students.reduce((sum, s) => sum + (Number.parseFloat(s.package) || 0), 0);
    const highestPackage = placedStudents
      ? Math.max(...students.map(s => Number.parseFloat(s.package) || 0))
      : 0;
    const totalCompanies = new Set(students.map(s => s.company)).size;
    const totalDrives = new Set(students.map(s => s.drive_id)).size;

    const totalByBranch = new Map(
      db.prepare(`
        SELECT branch, COUNT(*) as total
        FROM students
        WHERE is_active = 1
        GROUP BY branch
      `).all().map(row => [row.branch || 'Unknown', row.total])
    );

    const placedByBranch = new Map();
    students.forEach(s => {
      const key = s.branch || 'Unknown';
      const prev = placedByBranch.get(key) || 0;
      placedByBranch.set(key, prev + 1);
    });

    const branchKeys = new Set([...totalByBranch.keys(), ...placedByBranch.keys()]);
    const branchStats = [...branchKeys]
      .map((branch) => ({
        branch,
        total: totalByBranch.get(branch) || placedByBranch.get(branch) || 0,
        placed: placedByBranch.get(branch) || 0
      }))
      .sort((a, b) => b.placed - a.placed);

    return res.json({
      success: true,
      data: {
        students,
        summary: {
          placedStudents,
          avgPackage: placedStudents ? Number((totalPackage / placedStudents).toFixed(2)) : 0,
          highestPackage,
          totalCompanies,
          totalDrives
        },
        branchStats
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = {
  getProfile, updateProfile, uploadResume,
  getAvailableDrives, applyToDrive,
  getMyApplications, getMyInterviews, getMyOffer, respondToOffer,
  getMyNotifications, submitQuery, getMyQueries, getDashboardStats,
  getPlacedStudentsPublic
};
