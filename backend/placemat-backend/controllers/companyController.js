/**
 * PLACEMAT — controllers/companyController.js
 * Company dashboard operations
 */

const { getDb } = require('../database/db');
const path = require('path');
const fs   = require('fs');

// ─── PROFILE ──────────────────────────────────────────────────

function getProfile(req, res) {
  try {
    const db      = getDb();
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.user.id);
    if (!company) return res.status(404).json({ success: false, message: 'Company not found.' });
    delete company.password_hash;
    return res.json({ success: true, data: { company } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function updateProfile(req, res) {
  try {
    const { name, industry, phone, hr_name, website, description, address } = req.body;
    const db = getDb();
    db.prepare(`
      UPDATE companies SET name=?, industry=?, phone=?, hr_name=?, website=?, description=?, address=?, updated_at=?
      WHERE id=?
    `).run(name, industry, phone||null, hr_name||null, website||null, description||null, address||null,
           new Date().toISOString(), req.user.id);
    return res.json({ success: true, message: 'Profile updated.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function uploadLogo(req, res) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
    const logoPath = req.file.path;
    const db = getDb();

    // Delete old logo
    const existing = db.prepare('SELECT logo_path FROM companies WHERE id = ?').get(req.user.id);
    if (existing?.logo_path && fs.existsSync(existing.logo_path)) {
      fs.unlinkSync(existing.logo_path);
    }

    db.prepare('UPDATE companies SET logo_path = ?, updated_at = ? WHERE id = ?')
      .run(logoPath, new Date().toISOString(), req.user.id);

    return res.json({ success: true, message: 'Logo uploaded.', logo_path: logoPath });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── JOB DRIVES ───────────────────────────────────────────────

function getMyDrives(req, res) {
  try {
    const db     = getDb();
    const drives = db.prepare(`
      SELECT jd.*,
        (SELECT COUNT(*) FROM applications WHERE drive_id = jd.id) as applicant_count,
        (SELECT COUNT(*) FROM applications WHERE drive_id = jd.id AND status = 'selected') as selected_count
      FROM job_drives jd
      WHERE jd.company_id = ?
      ORDER BY jd.created_at DESC
    `).all(req.user.id);
    return res.json({ success: true, data: { drives } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function getDriveById(req, res) {
  try {
    const db    = getDb();
    const drive = db.prepare('SELECT * FROM job_drives WHERE id = ? AND company_id = ?')
      .get(req.params.id, req.user.id);
    if (!drive) return res.status(404).json({ success: false, message: 'Drive not found.' });
    return res.json({ success: true, data: { drive } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function createDrive(req, res) {
  try {
    const {
      title, description, job_type, location,
      package_min, package_max, stipend,
      eligible_branches, min_cgpa, eligible_years, skills_required, max_backlogs,
      application_deadline, drive_date, result_date, total_rounds
    } = req.body;

    if (!title) return res.status(400).json({ success: false, message: 'Drive title is required.' });

    const db     = getDb();
    const result = db.prepare(`
      INSERT INTO job_drives (
        company_id, title, description, job_type, location,
        package_min, package_max, stipend,
        eligible_branches, min_cgpa, eligible_years, skills_required, max_backlogs,
        status, application_deadline, drive_date, result_date, total_rounds
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      req.user.id, title, description||null, job_type||'full_time', location||null,
      package_min||null, package_max||null, stipend||null,
      JSON.stringify(eligible_branches || []),
      parseFloat(min_cgpa || 0),
      JSON.stringify(eligible_years || []),
      JSON.stringify(skills_required || []),
      parseInt(max_backlogs || 0),
      'upcoming',
      application_deadline||null, drive_date||null, result_date||null,
      parseInt(total_rounds || 1)
    );

    return res.status(201).json({ success: true, message: 'Drive created. Awaiting admin review.', driveId: result.lastInsertRowid });
  } catch (err) {
    console.error('Create drive error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function updateDrive(req, res) {
  try {
    const db    = getDb();
    const drive = db.prepare('SELECT id FROM job_drives WHERE id = ? AND company_id = ?')
      .get(req.params.id, req.user.id);
    if (!drive) return res.status(404).json({ success: false, message: 'Drive not found.' });

    const {
      title, description, job_type, location,
      package_min, package_max, stipend,
      eligible_branches, min_cgpa, eligible_years, skills_required, max_backlogs,
      application_deadline, drive_date, result_date, total_rounds
    } = req.body;

    db.prepare(`
      UPDATE job_drives SET
        title=?, description=?, job_type=?, location=?,
        package_min=?, package_max=?, stipend=?,
        eligible_branches=?, min_cgpa=?, eligible_years=?, skills_required=?, max_backlogs=?,
        application_deadline=?, drive_date=?, result_date=?, total_rounds=?, updated_at=?
      WHERE id=?
    `).run(
      title, description||null, job_type, location||null,
      package_min||null, package_max||null, stipend||null,
      JSON.stringify(eligible_branches||[]),
      parseFloat(min_cgpa||0),
      JSON.stringify(eligible_years||[]),
      JSON.stringify(skills_required||[]),
      parseInt(max_backlogs||0),
      application_deadline||null, drive_date||null, result_date||null,
      parseInt(total_rounds||1),
      new Date().toISOString(),
      req.params.id
    );
    return res.json({ success: true, message: 'Drive updated.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function closeDrive(req, res) {
  try {
    const db = getDb();
    db.prepare('UPDATE job_drives SET status="closed", updated_at=? WHERE id=? AND company_id=?')
      .run(new Date().toISOString(), req.params.id, req.user.id);
    return res.json({ success: true, message: 'Drive closed.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── APPLICANTS ───────────────────────────────────────────────

function getDriveApplicants(req, res) {
  try {
    const db = getDb();
    // Ensure drive belongs to this company
    const drive = db.prepare('SELECT id FROM job_drives WHERE id = ? AND company_id = ?')
      .get(req.params.id, req.user.id);
    if (!drive) return res.status(404).json({ success: false, message: 'Drive not found.' });

    const { status, branch, cgpa_min } = req.query;
    let where = 'a.drive_id = ?';
    const params = [drive.id];

    if (status)   { where += ' AND a.status = ?';  params.push(status); }
    if (branch)   { where += ' AND s.branch = ?';  params.push(branch); }
    if (cgpa_min) { where += ' AND s.cgpa >= ?';   params.push(parseFloat(cgpa_min)); }

    const applicants = db.prepare(`
      SELECT a.id as application_id, a.status, a.applied_at, a.notes,
             s.id as student_id, s.name, s.email, s.roll_number,
             s.branch, s.year, s.cgpa, s.phone, s.resume_path
      FROM applications a
      JOIN students s ON s.id = a.student_id
      WHERE ${where}
      ORDER BY s.cgpa DESC
    `).all(...params);

    return res.json({ success: true, data: { applicants, total: applicants.length } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function updateApplicationStatus(req, res) {
  try {
    const { status, notes } = req.body;
    const allowed = ['shortlisted', 'interview', 'selected', 'rejected'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const db  = getDb();
    // Verify company owns the drive
    const app = db.prepare(`
      SELECT a.id FROM applications a
      JOIN job_drives jd ON jd.id = a.drive_id
      WHERE a.id = ? AND jd.company_id = ?
    `).get(req.params.id, req.user.id);

    if (!app) return res.status(404).json({ success: false, message: 'Application not found.' });

    db.prepare('UPDATE applications SET status = ?, notes = ?, updated_at = ? WHERE id = ?')
      .run(status, notes||null, new Date().toISOString(), req.params.id);

    return res.json({ success: true, message: `Applicant ${status}.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function bulkUpdateApplications(req, res) {
  try {
    const { application_ids, status } = req.body;
    if (!Array.isArray(application_ids) || !status) {
      return res.status(400).json({ success: false, message: 'application_ids and status required.' });
    }
    const db   = getDb();
    const stmt = db.prepare('UPDATE applications SET status=?, updated_at=? WHERE id=?');
    const now  = new Date().toISOString();
    db.transaction(() => { application_ids.forEach(id => stmt.run(status, now, id)); })();
    return res.json({ success: true, message: `${application_ids.length} applications updated.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── INTERVIEWS ───────────────────────────────────────────────

function scheduleInterview(req, res) {
  try {
    const { application_id, round_number, round_name, scheduled_at, venue, mode, meeting_link } = req.body;
    if (!application_id || !round_number) {
      return res.status(400).json({ success: false, message: 'application_id and round_number required.' });
    }
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO interviews (application_id, round_number, round_name, scheduled_at, venue, mode, meeting_link)
      VALUES (?,?,?,?,?,?,?)
    `).run(application_id, round_number, round_name||`Round ${round_number}`,
           scheduled_at||null, venue||null, mode||'offline', meeting_link||null);

    // Update application status to 'interview'
    db.prepare('UPDATE applications SET status="interview", updated_at=? WHERE id=?')
      .run(new Date().toISOString(), application_id);

    return res.status(201).json({ success: true, message: 'Interview scheduled.', interviewId: result.lastInsertRowid });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function updateInterviewResult(req, res) {
  try {
    const { result, feedback } = req.body;
    const db = getDb();
    db.prepare('UPDATE interviews SET result=?, feedback=?, status="completed", updated_at=? WHERE id=?')
      .run(result||null, feedback||null, new Date().toISOString(), req.params.id);
    return res.json({ success: true, message: 'Interview result updated.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── OFFERS ───────────────────────────────────────────────────

function issueOffer(req, res) {
  try {
    const { application_id, package: pkg } = req.body;
    if (!application_id || !pkg) {
      return res.status(400).json({ success: false, message: 'application_id and package required.' });
    }

    const db  = getDb();
    const app = db.prepare(`
      SELECT a.student_id, jd.company_id, jd.id as drive_id
      FROM applications a
      JOIN job_drives jd ON jd.id = a.drive_id
      WHERE a.id = ? AND jd.company_id = ?
    `).get(application_id, req.user.id);

    if (!app) return res.status(404).json({ success: false, message: 'Application not found.' });

    const offerPath = req.file?.path || null;

    db.prepare(`
      INSERT OR REPLACE INTO offers (application_id, student_id, company_id, drive_id, package, offer_letter)
      VALUES (?,?,?,?,?,?)
    `).run(application_id, app.student_id, app.company_id, app.drive_id, parseFloat(pkg), offerPath);

    db.prepare('UPDATE applications SET status="selected", updated_at=? WHERE id=?')
      .run(new Date().toISOString(), application_id);

    return res.status(201).json({ success: true, message: 'Offer issued successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── REPORTS ──────────────────────────────────────────────────

function getReports(req, res) {
  try {
    const db = getDb();
    const driveStats = db.prepare(`
      SELECT jd.title, jd.status, jd.drive_date,
        COUNT(a.id) as total_applicants,
        SUM(CASE WHEN a.status='selected' THEN 1 ELSE 0 END) as selected,
        SUM(CASE WHEN a.status='rejected' THEN 1 ELSE 0 END) as rejected
      FROM job_drives jd
      LEFT JOIN applications a ON a.drive_id = jd.id
      WHERE jd.company_id = ?
      GROUP BY jd.id
      ORDER BY jd.created_at DESC
    `).all(req.user.id);

    const totalOffers  = db.prepare('SELECT COUNT(*) as c FROM offers WHERE company_id=?').get(req.user.id).c;
    const acceptedOffers = db.prepare('SELECT COUNT(*) as c FROM offers WHERE company_id=? AND status="accepted"').get(req.user.id).c;
    const avgPackage   = db.prepare('SELECT AVG(package) as avg FROM offers WHERE company_id=? AND status="accepted"').get(req.user.id).avg;

    return res.json({
      success: true,
      data: { driveStats, totalOffers, acceptedOffers, avgPackage: avgPackage?.toFixed(2) || 0 }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── QUERIES (Company → Admin) ────────────────────────────────

function submitQuery(req, res) {
  try {
    const { subject, message } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ success: false, message: 'Subject and message required.' });
    }
    const db = getDb();
    db.prepare('INSERT INTO queries (sender_id, sender_role, subject, message) VALUES (?,?,?,?)')
      .run(req.user.id, 'company', subject, message);
    return res.status(201).json({ success: true, message: 'Query submitted.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

function getMyQueries(req, res) {
  try {
    const db      = getDb();
    const queries = db.prepare('SELECT * FROM queries WHERE sender_id=? AND sender_role="company" ORDER BY created_at DESC').all(req.user.id);
    return res.json({ success: true, data: { queries } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ─── NOTIFICATIONS ────────────────────────────────────────────

function getMyNotifications(req, res) {
  try {
    const db = getDb();
    const notifications = db.prepare(`
      SELECT * FROM notifications
      WHERE (target_role='all' OR target_role='company')
        AND (target_id IS NULL OR target_id = ?)
      ORDER BY created_at DESC
      LIMIT 50
    `).all(req.user.id);
    return res.json({ success: true, data: { notifications } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = {
  getProfile, updateProfile, uploadLogo,
  getMyDrives, getDriveById, createDrive, updateDrive, closeDrive,
  getDriveApplicants, updateApplicationStatus, bulkUpdateApplications,
  scheduleInterview, updateInterviewResult,
  issueOffer,
  getReports,
  submitQuery, getMyQueries,
  getMyNotifications
};
