-- ============================================================
-- PLACEMAT — SQLite Schema
-- SCSIT DAVV Campus Placement System 2025-26
-- ============================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ============================================================
-- TABLE: admins
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'admin',          -- 'admin' | 'superadmin'
  is_active     INTEGER NOT NULL DEFAULT 1,
  last_login    TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);

-- ============================================================
-- TABLE: students
-- ============================================================
CREATE TABLE IF NOT EXISTS students (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT    NOT NULL,
  roll_number       TEXT    NOT NULL UNIQUE,
  email             TEXT    NOT NULL UNIQUE,
  email_verified    INTEGER NOT NULL DEFAULT 1,
  email_verified_at TEXT,
  verification_code_hash    TEXT,
  verification_code_expires TEXT,
  verification_code_sent_at TEXT,
  phone             TEXT,
  password_hash     TEXT    NOT NULL,
  branch            TEXT    NOT NULL,
  year              INTEGER NOT NULL,
  cgpa              REAL    NOT NULL DEFAULT 0.0,
  skills            TEXT    DEFAULT '[]',               -- JSON array
  resume_path       TEXT,
  resume_verified   INTEGER NOT NULL DEFAULT 0,
  profile_verified  INTEGER NOT NULL DEFAULT 0,
  is_placed         INTEGER NOT NULL DEFAULT 0,
  placed_company_id INTEGER REFERENCES companies(id),
  placement_package REAL,
  is_blocked        INTEGER NOT NULL DEFAULT 0,
  is_active         INTEGER NOT NULL DEFAULT 1,
  last_login        TEXT,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_students_email       ON students(email);
CREATE INDEX IF NOT EXISTS idx_students_roll        ON students(roll_number);
CREATE INDEX IF NOT EXISTS idx_students_branch      ON students(branch);
CREATE INDEX IF NOT EXISTS idx_students_cgpa        ON students(cgpa);
CREATE INDEX IF NOT EXISTS idx_students_is_placed   ON students(is_placed);

-- ============================================================
-- TABLE: companies
-- ============================================================
CREATE TABLE IF NOT EXISTS companies (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  email           TEXT    NOT NULL UNIQUE,
  email_verified  INTEGER NOT NULL DEFAULT 1,
  email_verified_at TEXT,
  verification_code_hash    TEXT,
  verification_code_expires TEXT,
  verification_code_sent_at TEXT,
  password_hash   TEXT    NOT NULL,
  industry        TEXT,
  phone           TEXT,
  hr_name         TEXT,
  website         TEXT,
  logo_path       TEXT,
  description     TEXT,
  address         TEXT,
  approval_status TEXT    NOT NULL DEFAULT 'pending',   -- 'pending'|'approved'|'rejected'
  is_active       INTEGER NOT NULL DEFAULT 1,
  rejection_note  TEXT,
  last_login      TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_companies_email   ON companies(email);
CREATE INDEX IF NOT EXISTS idx_companies_status  ON companies(approval_status);

-- ============================================================
-- TABLE: job_drives
-- ============================================================
CREATE TABLE IF NOT EXISTS job_drives (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id          INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title               TEXT    NOT NULL,
  description         TEXT,
  job_type            TEXT    NOT NULL DEFAULT 'full_time',  -- 'full_time'|'internship'|'contract'
  location            TEXT,
  package_min         REAL,
  package_max         REAL,
  stipend             REAL,
  -- Eligibility criteria
  eligible_branches   TEXT    NOT NULL DEFAULT '[]',         -- JSON array
  min_cgpa            REAL    NOT NULL DEFAULT 0.0,
  eligible_years      TEXT    NOT NULL DEFAULT '[]',         -- JSON array
  skills_required     TEXT    NOT NULL DEFAULT '[]',         -- JSON array
  max_backlogs        INTEGER NOT NULL DEFAULT 0,
  -- Drive management
  status              TEXT    NOT NULL DEFAULT 'upcoming',   -- 'upcoming'|'active'|'closed'|'cancelled'
  application_deadline TEXT,
  drive_date          TEXT,
  result_date         TEXT,
  total_rounds        INTEGER NOT NULL DEFAULT 1,
  created_by_admin    INTEGER NOT NULL DEFAULT 0,            -- 1 = admin created, 0 = company created
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_drives_company ON job_drives(company_id);
CREATE INDEX IF NOT EXISTS idx_drives_status  ON job_drives(status);

-- ============================================================
-- TABLE: applications
-- ============================================================
CREATE TABLE IF NOT EXISTS applications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  drive_id    INTEGER NOT NULL REFERENCES job_drives(id) ON DELETE CASCADE,
  status      TEXT    NOT NULL DEFAULT 'applied',  -- 'applied'|'shortlisted'|'interview'|'selected'|'rejected'|'withdrawn'
  applied_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  notes       TEXT,
  UNIQUE(student_id, drive_id)
);

CREATE INDEX IF NOT EXISTS idx_applications_student ON applications(student_id);
CREATE INDEX IF NOT EXISTS idx_applications_drive   ON applications(drive_id);
CREATE INDEX IF NOT EXISTS idx_applications_status  ON applications(status);

-- ============================================================
-- TABLE: interviews
-- ============================================================
CREATE TABLE IF NOT EXISTS interviews (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  round_number   INTEGER NOT NULL DEFAULT 1,
  round_name     TEXT    NOT NULL DEFAULT 'Round 1',  -- 'Aptitude'|'Technical'|'HR'|etc.
  scheduled_at   TEXT,
  venue          TEXT,
  mode           TEXT    NOT NULL DEFAULT 'offline',  -- 'offline'|'online'
  meeting_link   TEXT,
  status         TEXT    NOT NULL DEFAULT 'scheduled', -- 'scheduled'|'completed'|'cancelled'
  result         TEXT,                                -- 'passed'|'failed'|'pending'
  feedback       TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_interviews_application ON interviews(application_id);

-- ============================================================
-- TABLE: offers
-- ============================================================
CREATE TABLE IF NOT EXISTS offers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  student_id     INTEGER NOT NULL REFERENCES students(id),
  company_id     INTEGER NOT NULL REFERENCES companies(id),
  drive_id       INTEGER NOT NULL REFERENCES job_drives(id),
  package        REAL    NOT NULL,
  offer_letter   TEXT,                               -- file path
  status         TEXT    NOT NULL DEFAULT 'pending', -- 'pending'|'accepted'|'declined'
  issued_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  responded_at   TEXT,
  UNIQUE(application_id)
);

CREATE INDEX IF NOT EXISTS idx_offers_student  ON offers(student_id);
CREATE INDEX IF NOT EXISTS idx_offers_company  ON offers(company_id);
CREATE INDEX IF NOT EXISTS idx_offers_status   ON offers(status);

-- ============================================================
-- TABLE: notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT    NOT NULL,
  message     TEXT    NOT NULL,
  type        TEXT    NOT NULL DEFAULT 'general',   -- 'general'|'drive'|'interview'|'offer'|'system'
  target_role TEXT    NOT NULL DEFAULT 'all',       -- 'all'|'student'|'company'|'admin'
  target_id   INTEGER,                              -- specific user id (null = broadcast)
  target_branch TEXT,                               -- branch filter
  target_year INTEGER,                              -- year filter
  sent_by     INTEGER NOT NULL,                     -- admin id
  is_read     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notif_target_role ON notifications(target_role);
CREATE INDEX IF NOT EXISTS idx_notif_target_id   ON notifications(target_id);

-- ============================================================
-- TABLE: queries
-- ============================================================
CREATE TABLE IF NOT EXISTS queries (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id    INTEGER NOT NULL,
  sender_role  TEXT    NOT NULL,                    -- 'student'|'company'
  subject      TEXT    NOT NULL,
  message      TEXT    NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'open',     -- 'open'|'resolved'|'closed'
  reply        TEXT,
  replied_by   INTEGER,                             -- admin id
  replied_at   TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_queries_sender ON queries(sender_id, sender_role);
CREATE INDEX IF NOT EXISTS idx_queries_status ON queries(status);

-- ============================================================
-- TABLE: audit_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  user_role  TEXT    NOT NULL,
  action     TEXT    NOT NULL,
  entity     TEXT,                                  -- 'student'|'company'|'drive' etc.
  entity_id  INTEGER,
  details    TEXT,                                  -- JSON details
  ip_address TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_user    ON audit_logs(user_id, user_role);
CREATE INDEX IF NOT EXISTS idx_audit_entity  ON audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
