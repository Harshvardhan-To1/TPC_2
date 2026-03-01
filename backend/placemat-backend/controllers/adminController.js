/**
 * PLACEMAT — controllers/adminController.js
 * All admin management operations
 */

const { getDb } = require('../database/db');
const bcrypt    = require('bcrypt');
const path      = require('path');
const fs        = require('fs');
const { BCRYPT_ROUNDS } = require('../config/env');

// ─── DASHBOARD STATS ──────────────────────────────────────────

function getDashboardStats(req, res) {
  try {
    const db = getDb();

    const totalStudents   = db.prepare('SELECT COUNT(*) as c FROM students WHERE is_active=1').get().c;
    const placedStudents  = db.prepare('SELECT COUNT(*) as c FROM students WHERE is_placed=1').get().c;
    const totalCompanies  = db.prepare("SELECT COUNT(*) as c FROM companies WHERE approval_status='approved'").get().c;
    const pendingCompanies= db.prepare("SELECT COUNT(*) as c FROM companies WHERE approval_status='pending'").get().c;
    const activeDrives    = db.prepare("SELECT COUNT(*) as c FROM job_drives WHERE status='active'").get().c;
    const totalDrives     = db.prepare('SELECT COUNT(*) as c FROM job_drives').get().c;
    const totalApplications = db.prepare('SELECT COUNT(*) as c FROM applications').get().c;
    const avgPackage      = db.prepare("SELECT AVG(package) as avg FROM offers WHERE status='accepted'").get().avg;
    const highestPackage  = db.prepare("SELECT MAX(package) as max FROM offers WHERE status='accepted'").get().max;

    const placementRate   = totalStudents > 0 ? ((placedStudents / totalStudents) * 100).toFixed(1) : 0;

    const branchStats = db.prepare(`
      SELECT branch,
        COUNT(*) as total,
        SUM(is_placed) as placed
      FROM students
      WHERE is_active = 1
      GROUP BY branch
      ORDER BY placed DESC
    `).all();

    const recentDrives = db.prepare(`
      SELECT jd.id, jd.title, jd.status, jd.drive_date, jd.package_min, jd.package_max,
             c.name as company_name,
             (SELECT COUNT(*) FROM applications WHERE drive_id = jd.id) as applicant_count
      FROM job_drives jd
      JOIN companies c ON c.id = jd.company_id
      ORDER BY jd.created_at DESC
      LIMIT 5
    `).all();

    const recentCompanies = db.prepare(`
      SELECT id, name, industry, approval_status, created_at
      FROM companies
      ORDER BY created_at DESC
      LIMIT 5
    `).all();

    return res.json({
      success: true,
      data: {
        overview: {
          totalStudents, placedStudents, placementRate,
          totalCompanies, pendingCompanies, activeDrives,
          totalDrives, totalApplications,
          avgPackage: avgPackage?.toFixed(2) || 0,
          highestPackage: highestPackage || 0
        },
        branchStats,
        recentDrives,
        recentCompanies
      }
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── COMPANY MANAGEMENT ───────────────────────────────────────

function getAllCompanies(req, res) {
  try {
    const db     = getDb();
    const { status, page = 1, limit = 20, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = '1=1';
    const params = [];

    if (status) { where += ' AND c.approval_status = ?'; params.push(status); }
    if (search) {
      where += ' AND (c.name LIKE ? OR c.email LIKE ? OR c.industry LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const companies = db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM job_drives WHERE company_id = c.id) as total_drives,
        (SELECT COUNT(*) FROM job_drives WHERE company_id = c.id AND status = 'active') as active_drives
      FROM companies c
      WHERE ${where}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    const total = db.prepare(`SELECT COUNT(*) as c FROM companies c WHERE ${where}`).get(...params).c;

    // Strip password hashes
    companies.forEach(c => delete c.password_hash);

    return res.json({ success: true, data: { companies, total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) {
    console.error('Get companies error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function getCompanyById(req, res) {
  try {
    const db      = getDb();
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found.' });
    delete company.password_hash;
    const drives = db.prepare(`
      SELECT jd.*, (SELECT COUNT(*) FROM applications WHERE drive_id = jd.id) as applicant_count
      FROM job_drives jd WHERE jd.company_id = ? ORDER BY jd.created_at DESC
    `).all(company.id);
    return res.json({ success: true, data: { company, drives } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function updateCompanyStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, rejection_note } = req.body;
    const allowed = ['pending', 'approved', 'rejected'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }
    const db = getDb();
    db.prepare('UPDATE companies SET approval_status = ?, rejection_note = ?, updated_at = ? WHERE id = ?')
      .run(status, rejection_note || null, new Date().toISOString(), id);
    return res.json({ success: true, message: `Company ${status} successfully.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function toggleCompanyActive(req, res) {
  try {
    const db      = getDb();
    const company = db.prepare('SELECT id, is_active FROM companies WHERE id = ?').get(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found.' });
    const newState = company.is_active ? 0 : 1;
    db.prepare('UPDATE companies SET is_active = ?, updated_at = ? WHERE id = ?')
      .run(newState, new Date().toISOString(), company.id);
    return res.json({ success: true, message: `Company ${newState ? 'activated' : 'deactivated'}.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── STUDENT MANAGEMENT ───────────────────────────────────────

function getAllStudents(req, res) {
  try {
    const db  = getDb();
    const { branch, year, cgpa_min, cgpa_max, is_placed, is_blocked, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where  = '1=1';
    const params = [];

    if (branch)  { where += ' AND branch = ?'; params.push(branch); }
    if (year)    { where += ' AND year = ?';   params.push(parseInt(year)); }
    if (cgpa_min){ where += ' AND cgpa >= ?';  params.push(parseFloat(cgpa_min)); }
    if (cgpa_max){ where += ' AND cgpa <= ?';  params.push(parseFloat(cgpa_max)); }
    if (is_placed !== undefined) { where += ' AND is_placed = ?'; params.push(parseInt(is_placed)); }
    if (is_blocked !== undefined){ where += ' AND is_blocked = ?'; params.push(parseInt(is_blocked)); }
    if (search) {
      where += ' AND (name LIKE ? OR email LIKE ? OR roll_number LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const students = db.prepare(`
      SELECT id, name, roll_number, email, phone, branch, year, cgpa, skills,
             resume_path, resume_verified, profile_verified, is_placed, is_blocked,
             placement_package, last_login, created_at
      FROM students
      WHERE is_active = 1 AND ${where}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    const total = db.prepare(`SELECT COUNT(*) as c FROM students WHERE is_active=1 AND ${where}`).get(...params).c;

    return res.json({ success: true, data: { students, total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) {
    console.error('Get students error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function getStudentById(req, res) {
  try {
    const db      = getDb();
    const student = db.prepare(`
      SELECT s.*, c.name as placed_company_name
      FROM students s
      LEFT JOIN companies c ON c.id = s.placed_company_id
      WHERE s.id = ?
    `).get(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });
    delete student.password_hash;

    const applications = db.prepare(`
      SELECT a.*, jd.title as drive_title, comp.name as company_name
      FROM applications a
      JOIN job_drives jd ON jd.id = a.drive_id
      JOIN companies comp ON comp.id = jd.company_id
      WHERE a.student_id = ?
      ORDER BY a.applied_at DESC
    `).all(student.id);

    return res.json({ success: true, data: { student, applications } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function toggleStudentBlock(req, res) {
  try {
    const db      = getDb();
    const student = db.prepare('SELECT id, is_blocked FROM students WHERE id = ?').get(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });
    const newState = student.is_blocked ? 0 : 1;
    db.prepare('UPDATE students SET is_blocked = ?, updated_at = ? WHERE id = ?')
      .run(newState, new Date().toISOString(), student.id);
    return res.json({ success: true, message: `Student ${newState ? 'blocked' : 'unblocked'}.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function verifyStudentProfile(req, res) {
  try {
    const { profile_verified, resume_verified } = req.body;
    const db = getDb();
    const student = db.prepare('SELECT id, profile_verified, resume_verified FROM students WHERE id = ?').get(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });

    const nextProfileVerified = profile_verified !== undefined
      ? Number.parseInt(profile_verified, 10)
      : student.profile_verified;
    const nextResumeVerified = resume_verified !== undefined
      ? Number.parseInt(resume_verified, 10)
      : student.resume_verified;

    if (![0, 1].includes(nextProfileVerified) || ![0, 1].includes(nextResumeVerified)) {
      return res.status(400).json({ success: false, message: 'Verification values must be 0 or 1.' });
    }

    db.prepare(`
      UPDATE students
      SET profile_verified = ?, resume_verified = ?, updated_at = ?
      WHERE id = ?
    `).run(
      nextProfileVerified,
      nextResumeVerified,
      new Date().toISOString(),
      req.params.id
    );
    return res.json({ success: true, message: 'Student verification updated.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function markStudentPlaced(req, res) {
  try {
    const { company_id, package: pkg } = req.body;
    if (!company_id || !pkg) {
      return res.status(400).json({ success: false, message: 'company_id and package are required.' });
    }
    const db = getDb();

    const student = db.prepare('SELECT id FROM students WHERE id = ?').get(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });
    const company = db.prepare('SELECT id FROM companies WHERE id = ?').get(company_id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found.' });

    db.prepare(`
      UPDATE students
      SET is_placed = 1, placed_company_id = ?, placement_package = ?, updated_at = ?
      WHERE id = ?
    `).run(company_id, parseFloat(pkg), new Date().toISOString(), req.params.id);
    return res.json({ success: true, message: 'Student marked as placed.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── JOB DRIVES ───────────────────────────────────────────────

function getAllDrives(req, res) {
  try {
    const db = getDb();
    const { status, company_id, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where  = '1=1';
    const params = [];
    if (status)     { where += ' AND jd.status = ?';     params.push(status); }
    if (company_id) { where += ' AND jd.company_id = ?'; params.push(company_id); }

    const drives = db.prepare(`
      SELECT jd.*, c.name as company_name, c.logo_path as company_logo,
        (SELECT COUNT(*) FROM applications WHERE drive_id = jd.id) as applicant_count,
        (SELECT COUNT(*) FROM applications WHERE drive_id = jd.id AND status = 'selected') as selected_count
      FROM job_drives jd
      JOIN companies c ON c.id = jd.company_id
      WHERE ${where}
      ORDER BY jd.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    const total = db.prepare(`SELECT COUNT(*) as c FROM job_drives jd WHERE ${where}`).get(...params).c;

    return res.json({ success: true, data: { drives, total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) {
    console.error('Get drives error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function createDrive(req, res) {
  try {
    const {
      company_id, title, description, job_type, location,
      package_min, package_max, stipend,
      eligible_branches, min_cgpa, eligible_years, skills_required, max_backlogs,
      status, application_deadline, drive_date, result_date, total_rounds
    } = req.body;

    if (!company_id || !title) {
      return res.status(400).json({ success: false, message: 'company_id and title are required.' });
    }

    const db = getDb();
    const result = db.prepare(`
      INSERT INTO job_drives (
        company_id, title, description, job_type, location,
        package_min, package_max, stipend,
        eligible_branches, min_cgpa, eligible_years, skills_required, max_backlogs,
        status, application_deadline, drive_date, result_date, total_rounds, created_by_admin
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)
    `).run(
      company_id, title, description || null, job_type || 'full_time', location || null,
      package_min || null, package_max || null, stipend || null,
      JSON.stringify(eligible_branches || []),
      parseFloat(min_cgpa || 0),
      JSON.stringify(eligible_years || []),
      JSON.stringify(skills_required || []),
      parseInt(max_backlogs || 0),
      status || 'upcoming',
      application_deadline || null, drive_date || null, result_date || null,
      parseInt(total_rounds || 1)
    );

    return res.status(201).json({ success: true, message: 'Drive created.', driveId: result.lastInsertRowid });
  } catch (err) {
    console.error('Create drive error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function updateDrive(req, res) {
  try {
    const db    = getDb();
    const drive = db.prepare('SELECT id FROM job_drives WHERE id = ?').get(req.params.id);
    if (!drive) return res.status(404).json({ success: false, message: 'Drive not found.' });

    const {
      title, description, job_type, location,
      package_min, package_max, stipend,
      eligible_branches, min_cgpa, eligible_years, skills_required, max_backlogs,
      status, application_deadline, drive_date, result_date, total_rounds
    } = req.body;

    db.prepare(`
      UPDATE job_drives SET
        title=?, description=?, job_type=?, location=?,
        package_min=?, package_max=?, stipend=?,
        eligible_branches=?, min_cgpa=?, eligible_years=?, skills_required=?, max_backlogs=?,
        status=?, application_deadline=?, drive_date=?, result_date=?, total_rounds=?,
        updated_at=?
      WHERE id=?
    `).run(
      title, description || null, job_type, location || null,
      package_min || null, package_max || null, stipend || null,
      JSON.stringify(eligible_branches || []),
      parseFloat(min_cgpa || 0),
      JSON.stringify(eligible_years || []),
      JSON.stringify(skills_required || []),
      parseInt(max_backlogs || 0),
      status, application_deadline || null, drive_date || null, result_date || null,
      parseInt(total_rounds || 1),
      new Date().toISOString(),
      req.params.id
    );

    return res.json({ success: true, message: 'Drive updated successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function deleteDrive(req, res) {
  try {
    const db = getDb();
    db.prepare('DELETE FROM job_drives WHERE id = ?').run(req.params.id);
    return res.json({ success: true, message: 'Drive deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function changeDriveStatus(req, res) {
  try {
    const { status } = req.body;
    const allowed = ['upcoming', 'active', 'closed', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }
    const db = getDb();
    db.prepare('UPDATE job_drives SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, new Date().toISOString(), req.params.id);
    return res.json({ success: true, message: `Drive status changed to ${status}.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── APPLICATION MANAGEMENT ───────────────────────────────────

function getDriveApplicants(req, res) {
  try {
    const db = getDb();
    const { drive_id } = req.params;
    const { status } = req.query;

    let where  = 'a.drive_id = ?';
    const params = [drive_id];
    if (status) { where += ' AND a.status = ?'; params.push(status); }

    const applicants = db.prepare(`
      SELECT a.id as application_id, a.status, a.applied_at, a.notes,
             s.id as student_id, s.name, s.email, s.roll_number, s.branch,
             s.year, s.cgpa, s.resume_path, s.phone,
             jd.title as drive_title, c.name as company_name
      FROM applications a
      JOIN students s ON s.id = a.student_id
      JOIN job_drives jd ON jd.id = a.drive_id
      JOIN companies c ON c.id = jd.company_id
      WHERE ${where}
      ORDER BY a.applied_at ASC
    `).all(...params);

    return res.json({ success: true, data: { applicants, total: applicants.length } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function updateApplicationStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const allowed = ['applied', 'shortlisted', 'interview', 'selected', 'rejected', 'withdrawn'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid application status.' });
    }

    const db = getDb();
    db.prepare('UPDATE applications SET status = ?, notes = ?, updated_at = ? WHERE id = ?')
      .run(status, notes || null, new Date().toISOString(), id);

    return res.json({ success: true, message: `Application ${status}.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function bulkUpdateApplications(req, res) {
  try {
    const { application_ids, status } = req.body;
    if (!Array.isArray(application_ids) || !status) {
      return res.status(400).json({ success: false, message: 'application_ids array and status required.' });
    }
    const db = getDb();
    const stmt = db.prepare('UPDATE applications SET status = ?, updated_at = ? WHERE id = ?');
    const now  = new Date().toISOString();
    const update = db.transaction(() => {
      application_ids.forEach(aid => stmt.run(status, now, aid));
    });
    update();
    return res.json({ success: true, message: `${application_ids.length} applications updated to ${status}.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function getAllInterviews(req, res) {
  try {
    const db = getDb();
    const { status } = req.query;
    let where = '1=1';
    const params = [];
    if (status) {
      where += ' AND i.status = ?';
      params.push(status);
    }

    const interviews = db.prepare(`
      SELECT i.id, i.round_number, i.round_name, i.scheduled_at, i.mode, i.venue, i.meeting_link, i.status, i.result,
             s.name as student_name, c.name as company_name, jd.title as drive_title
      FROM interviews i
      JOIN applications a ON a.id = i.application_id
      JOIN students s ON s.id = a.student_id
      JOIN job_drives jd ON jd.id = a.drive_id
      JOIN companies c ON c.id = jd.company_id
      WHERE ${where}
      ORDER BY i.scheduled_at DESC, i.created_at DESC
      LIMIT 250
    `).all(...params);

    return res.json({ success: true, data: { interviews } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function scheduleInterview(req, res) {
  try {
    const { application_id, round_number, round_name, scheduled_at, venue, mode, meeting_link } = req.body;
    if (!application_id || !round_number) {
      return res.status(400).json({ success: false, message: 'application_id and round_number are required.' });
    }

    const db = getDb();
    const application = db.prepare('SELECT id FROM applications WHERE id = ?').get(application_id);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    const result = db.prepare(`
      INSERT INTO interviews (application_id, round_number, round_name, scheduled_at, venue, mode, meeting_link)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      Number.parseInt(application_id, 10),
      Number.parseInt(round_number, 10),
      round_name || `Round ${round_number}`,
      scheduled_at || null,
      venue || null,
      mode || 'offline',
      meeting_link || null
    );

    db.prepare("UPDATE applications SET status = 'interview', updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), application_id);

    return res.status(201).json({
      success: true,
      message: 'Interview scheduled.',
      interviewId: result.lastInsertRowid
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── NOTIFICATIONS ────────────────────────────────────────────

function sendNotification(req, res) {
  try {
    const { title, message, type, target_role, target_id, target_branch, target_year } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message are required.' });
    }
    const db = getDb();
    db.prepare(`
      INSERT INTO notifications (title, message, type, target_role, target_id, target_branch, target_year, sent_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title, message,
      type         || 'general',
      target_role  || 'all',
      target_id    || null,
      target_branch|| null,
      target_year  || null,
      req.user.id
    );
    return res.status(201).json({ success: true, message: 'Notification sent.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function getNotifications(req, res) {
  try {
    const db = getDb();
    const notifications = db.prepare(`
      SELECT n.*, a.name as sent_by_name
      FROM notifications n
      JOIN admins a ON a.id = n.sent_by
      ORDER BY n.created_at DESC
      LIMIT 100
    `).all();
    return res.json({ success: true, data: { notifications } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── QUERIES ──────────────────────────────────────────────────

function getAllQueries(req, res) {
  try {
    const db = getDb();
    const { status } = req.query;
    let where = '1=1';
    const params = [];
    if (status) { where += ' AND status = ?'; params.push(status); }
    const queries = db.prepare(`SELECT * FROM queries WHERE ${where} ORDER BY created_at DESC LIMIT 100`).all(...params);
    return res.json({ success: true, data: { queries } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function replyQuery(req, res) {
  try {
    const { reply } = req.body;
    if (!reply) return res.status(400).json({ success: false, message: 'Reply text is required.' });
    const db = getDb();
    db.prepare(`
      UPDATE queries SET reply = ?, replied_by = ?, replied_at = ?, status = 'resolved', updated_at = ?
      WHERE id = ?
    `).run(reply, req.user.id, new Date().toISOString(), new Date().toISOString(), req.params.id);
    return res.json({ success: true, message: 'Query replied and resolved.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── ANALYTICS ────────────────────────────────────────────────

function getAnalytics(req, res) {
  try {
    const db = getDb();

    const monthlyPlacements = db.prepare(`
      SELECT strftime('%Y-%m', o.issued_at) as month, COUNT(*) as count, SUM(o.package) as total_package
      FROM offers o WHERE o.status = 'accepted'
      GROUP BY month ORDER BY month ASC LIMIT 12
    `).all();

    const branchWise = db.prepare(`
      SELECT s.branch,
        COUNT(*) as total_students,
        SUM(s.is_placed) as placed_students,
        AVG(CASE WHEN s.is_placed=1 THEN s.placement_package END) as avg_package
      FROM students s WHERE s.is_active = 1
      GROUP BY s.branch
    `).all();

    const companyWise = db.prepare(`
      SELECT c.name as company_name, c.industry,
        (SELECT COUNT(*) FROM offers o WHERE o.company_id = c.id AND o.status='accepted') as offers_given,
        (SELECT MAX(package) FROM offers o WHERE o.company_id = c.id AND o.status='accepted') as max_package,
        (SELECT AVG(package) FROM offers o WHERE o.company_id = c.id AND o.status='accepted') as avg_package
      FROM companies c
      WHERE c.approval_status = 'approved'
      HAVING offers_given > 0
      ORDER BY offers_given DESC
      LIMIT 15
    `).all();

    const topPackages = db.prepare(`
      SELECT s.name, s.branch, s.roll_number, o.package, c.name as company_name
      FROM offers o
      JOIN students s ON s.id = o.student_id
      JOIN companies c ON c.id = o.company_id
      WHERE o.status = 'accepted'
      ORDER BY o.package DESC
      LIMIT 10
    `).all();

    return res.json({
      success: true,
      data: { monthlyPlacements, branchWise, companyWise, topPackages }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── AUDIT LOGS ───────────────────────────────────────────────

function getAuditLogs(req, res) {
  try {
    const db   = getDb();
    const logs = db.prepare(`
      SELECT * FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 200
    `).all();
    return res.json({ success: true, data: { logs } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = {
  getDashboardStats,
  getAllCompanies, getCompanyById, updateCompanyStatus, toggleCompanyActive,
  getAllStudents, getStudentById, toggleStudentBlock, verifyStudentProfile, markStudentPlaced,
  getAllDrives, createDrive, updateDrive, deleteDrive, changeDriveStatus,
  getDriveApplicants, updateApplicationStatus, bulkUpdateApplications,
  getAllInterviews, scheduleInterview,
  sendNotification, getNotifications,
  getAllQueries, replyQuery,
  getAnalytics, getAuditLogs
};
