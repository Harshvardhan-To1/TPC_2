const bcrypt = require('bcrypt');
const { getAsync, runAsync } = require('../database/db');
const { generateToken } = require('../middlewares/auth');
const { BCRYPT_ROUNDS } = require('../config/env');

async function register(req, res) {
  try {
    const { name, roll_number, email, phone, branch, year, cgpa, password } = req.body;
    if (!name || !roll_number || !email || !branch || !year || cgpa === undefined || !password)
      return res.status(400).json({ success: false, message: 'All required fields must be filled.' });
    if (password.length < 8)
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });

    const existing = await getAsync(
      'SELECT id FROM students WHERE email = ? OR roll_number = ?',
      [email.toLowerCase().trim(), roll_number.trim()]
    );
    if (existing)
      return res.status(409).json({ success: false, message: 'Email or roll number already registered.' });

    const hash = await bcrypt.hash(password, parseInt(BCRYPT_ROUNDS));
    const result = await runAsync(
      'INSERT INTO students (name, roll_number, email, phone, branch, year, cgpa, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name.trim(), roll_number.trim(), email.toLowerCase().trim(), phone || null, branch, parseInt(year), parseFloat(cgpa), hash]
    );

    return res.status(201).json({
      success: true,
      message: 'Registration successful. Please login.',
      studentId: result.lastInsertRowid
    });
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

    const student = await getAsync(
      'SELECT * FROM students WHERE email = ? AND is_active = 1',
      [email.toLowerCase().trim()]
    );
    if (!student)
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    if (student.is_blocked)
      return res.status(403).json({ success: false, message: 'Your account has been blocked. Contact admin.' });

    const match = await bcrypt.compare(password, student.password_hash);
    if (!match)
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });

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

module.exports = { register, login };