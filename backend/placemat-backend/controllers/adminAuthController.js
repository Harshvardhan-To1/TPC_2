const bcrypt = require('bcrypt');
const { getAsync, runAsync } = require('../database/db');
const { generateToken } = require('../middlewares/auth');

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password are required.' });

    const admin = await getAsync(
      'SELECT * FROM admins WHERE email = ? AND is_active = 1',
      [email.toLowerCase().trim()]
    );
    if (!admin)
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });

    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match)
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });

    await runAsync(
      'UPDATE admins SET last_login = ? WHERE id = ?',
      [new Date().toISOString(), admin.id]
    );

    const token = generateToken({ id: admin.id, role: admin.role, email: admin.email });

    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: { id: admin.id, name: admin.name, email: admin.email, role: admin.role }
    });
  } catch (err) {
    console.error('Admin login error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

module.exports = { login };