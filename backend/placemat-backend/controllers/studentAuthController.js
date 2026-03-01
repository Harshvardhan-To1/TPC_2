const bcrypt = require('bcrypt');
const { getAsync, runAsync } = require('../database/db');
const { generateToken } = require('../middlewares/auth');
const { BCRYPT_ROUNDS, NODE_ENV } = require('../config/env');
const { sendVerificationEmail } = require('../utils/emailService');
const {
  normalizeEmail,
  buildVerificationRecord,
  verifyCode,
  isCodeExpired,
  canResendCode,
  getResendWaitSeconds
} = require('../utils/emailVerification');

async function register(req, res) {
  try {
    const { name, roll_number, email, phone, branch, year, cgpa, password } = req.body;
    if (!name || !roll_number || !email || !branch || !year || cgpa === undefined || !password)
      return res.status(400).json({ success: false, message: 'All required fields must be filled.' });
    if (password.length < 8)
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });

    const normalizedEmail = normalizeEmail(email);
    const existing = await getAsync(
      'SELECT id FROM students WHERE email = ? OR roll_number = ?',
      [normalizedEmail, roll_number.trim()]
    );
    if (existing)
      return res.status(409).json({ success: false, message: 'Email or roll number already registered.' });

    const verification = await buildVerificationRecord();
    const hash = await bcrypt.hash(password, parseInt(BCRYPT_ROUNDS));
    const result = await runAsync(
      `INSERT INTO students (
        name, roll_number, email, phone, branch, year, cgpa, password_hash,
        email_verified, verification_code_hash, verification_code_expires, verification_code_sent_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [
        name.trim(),
        roll_number.trim(),
        normalizedEmail,
        phone || null,
        branch,
        parseInt(year),
        parseFloat(cgpa),
        hash,
        verification.codeHash,
        verification.expiresAt,
        verification.sentAt
      ]
    );

    const delivery = await sendVerificationEmail({
      to: normalizedEmail,
      name: name.trim(),
      code: verification.code,
      roleLabel: 'student'
    });

    const responseBody = {
      success: true,
      message: 'Registration successful. Please verify your email before logging in.',
      studentId: result.lastInsertRowid,
      requires_email_verification: true,
      email: normalizedEmail
    };

    if (!delivery.delivered) {
      responseBody.message += ' Email service is not configured; use the verification flow from the app.';
    }
    if (NODE_ENV !== 'production') {
      responseBody.debug_verification_code = verification.code;
    }

    return res.status(201).json(responseBody);
  } catch (err) {
    console.error('Student register error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password are required.' });

    const normalizedEmail = normalizeEmail(email);
    const student = await getAsync(
      'SELECT * FROM students WHERE email = ? AND is_active = 1',
      [normalizedEmail]
    );
    if (!student)
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    if (student.is_blocked)
      return res.status(403).json({ success: false, message: 'Your account has been blocked. Contact admin.' });

    const match = await bcrypt.compare(password, student.password_hash);
    if (!match)
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    if (!student.email_verified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in.',
        requires_email_verification: true,
        email: student.email
      });
    }

    await runAsync(
      'UPDATE students SET last_login = ? WHERE id = ?',
      [new Date().toISOString(), student.id]
    );

    const token = generateToken({ id: student.id, role: 'student', email: student.email });

    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: student.id,
        name: student.name,
        email: student.email,
        role: 'student',
        branch: student.branch,
        roll_number: student.roll_number,
        is_placed: student.is_placed
      }
    });
  } catch (err) {
    console.error('Student login error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function verifyEmail(req, res) {
  try {
    const normalizedEmail = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || '').trim();

    if (!normalizedEmail || !code) {
      return res.status(400).json({ success: false, message: 'email and code are required.' });
    }

    const student = await getAsync(
      `SELECT id, email, email_verified, verification_code_hash, verification_code_expires
       FROM students WHERE email = ?`,
      [normalizedEmail]
    );

    if (!student) {
      return res.status(404).json({ success: false, message: 'No account found for this email.' });
    }

    if (student.email_verified) {
      return res.json({ success: true, message: 'Email is already verified.' });
    }

    if (!student.verification_code_hash || !student.verification_code_expires) {
      return res.status(400).json({
        success: false,
        message: 'Verification code not found. Please request a new code.'
      });
    }

    if (isCodeExpired(student.verification_code_expires)) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new code.'
      });
    }

    const valid = await verifyCode(code, student.verification_code_hash);
    if (!valid) {
      return res.status(400).json({ success: false, message: 'Invalid verification code.' });
    }

    const now = new Date().toISOString();
    await runAsync(
      `UPDATE students
       SET email_verified = 1,
           email_verified_at = ?,
           verification_code_hash = NULL,
           verification_code_expires = NULL,
           verification_code_sent_at = NULL,
           updated_at = ?
       WHERE id = ?`,
      [now, now, student.id]
    );

    return res.json({ success: true, message: 'Email verified successfully. You can now login.' });
  } catch (err) {
    console.error('Student verify email error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function resendVerification(req, res) {
  try {
    const normalizedEmail = normalizeEmail(req.body?.email);
    if (!normalizedEmail) {
      return res.status(400).json({ success: false, message: 'email is required.' });
    }

    const student = await getAsync(
      `SELECT id, name, email, email_verified, verification_code_sent_at
       FROM students WHERE email = ?`,
      [normalizedEmail]
    );
    if (!student) {
      return res.status(404).json({ success: false, message: 'No account found for this email.' });
    }

    if (student.email_verified) {
      return res.json({ success: true, message: 'Email is already verified.' });
    }

    if (!canResendCode(student.verification_code_sent_at)) {
      const waitSeconds = getResendWaitSeconds(student.verification_code_sent_at);
      return res.status(429).json({
        success: false,
        message: `Please wait ${waitSeconds}s before requesting a new code.`
      });
    }

    const verification = await buildVerificationRecord();
    await runAsync(
      `UPDATE students
       SET verification_code_hash = ?,
           verification_code_expires = ?,
           verification_code_sent_at = ?,
           updated_at = ?
       WHERE id = ?`,
      [
        verification.codeHash,
        verification.expiresAt,
        verification.sentAt,
        new Date().toISOString(),
        student.id
      ]
    );

    const delivery = await sendVerificationEmail({
      to: student.email,
      name: student.name,
      code: verification.code,
      roleLabel: 'student'
    });

    const responseBody = {
      success: true,
      message: 'Verification code sent. Please check your email.'
    };
    if (!delivery.delivered) {
      responseBody.message += ' Email service is not configured; use the app flow to continue.';
    }
    if (NODE_ENV !== 'production') {
      responseBody.debug_verification_code = verification.code;
    }

    return res.json(responseBody);
  } catch (err) {
    console.error('Student resend verification error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = { register, login, verifyEmail, resendVerification };