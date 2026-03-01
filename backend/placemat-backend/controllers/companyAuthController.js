const bcrypt = require('bcrypt');
const { getAsync, runAsync } = require('../database/db');
const { generateToken } = require('../middlewares/auth');
const { BCRYPT_ROUNDS } = require('../config/env');

async function register(req, res) {
  try {
    const { name, industry, email, phone, hr_name, website, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
    if (password.length < 8)
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });

    const existing = await getAsync(
      'SELECT id FROM companies WHERE email = ?',
      [email.toLowerCase().trim()]
    );
    if (existing)
      return res.status(409).json({ success: false, message: 'This email is already registered.' });

    const hash = await bcrypt.hash(password, parseInt(BCRYPT_ROUNDS));
    await runAsync(
      'INSERT INTO companies (name, email, password_hash, industry, phone, hr_name, website) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name.trim(), email.toLowerCase().trim(), hash, industry || null, phone || null, hr_name || null, website || null]
    );

    return res.status(201).json({
      success: true,
      message: 'Registration submitted. Await admin approval to login.'
    });
  } catch (err) {
    console.error('Company register error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password are required.' });

    const company = await getAsync(
      'SELECT * FROM companies WHERE email = ?',
      [email.toLowerCase().trim()]
    );
    if (!company)
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });

    if (company.approval_status === 'pending')
      return res.status(403).json({ success: false, message: 'Your account is pending admin approval.' });
    if (company.approval_status === 'rejected')
      return res.status(403).json({ success: false, message: 'Your registration was rejected. Contact admin.' });
    if (!company.is_active)
      return res.status(403).json({ success: false, message: 'Your account has been deactivated.' });

    const match = await bcrypt.compare(password, company.password_hash);
    if (!match)
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });

    await runAsync(
      'UPDATE companies SET last_login = ? WHERE id = ?',
      [new Date().toISOString(), company.id]
    );

    const token = generateToken({ id: company.id, role: 'company', email: company.email });

    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: company.id,
        name: company.name,
        email: company.email,
        role: 'company',
        industry: company.industry
      }
    });
  } catch (err) {
    console.error('Company login error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = { register, login };