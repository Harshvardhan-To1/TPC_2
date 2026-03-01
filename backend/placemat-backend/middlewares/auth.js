/**
 * PLACEMAT — middlewares/auth.js
 * JWT authentication + role-based authorization
 */

const jwt  = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');

/**
 * Verify JWT token from Authorization header or cookie
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token      = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : req.cookies?.placemat_token;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user      = decoded;  // { id, role, email }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired. Please login again.' });
    }
    return res.status(403).json({ success: false, message: 'Invalid token.' });
  }
}

/**
 * Authorize specific roles
 * Usage: authorizeRoles('admin', 'superadmin')
 */
function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}.`
      });
    }
    next();
  };
}

/**
 * Generate JWT token
 */
function generateToken(payload) {
  const { JWT_EXPIRES_IN } = require('../config/env');
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

module.exports = { authenticateToken, authorizeRoles, generateToken };
