/**
 * PLACEMAT — middlewares/validate.js
 * Request body validation helpers
 */

/**
 * Validate required fields exist and are non-empty
 * @param {string[]} fields 
 */
function requireFields(...fields) {
  return (req, res, next) => {
    const missing = fields.filter(f => {
      const val = req.body[f];
      return val === undefined || val === null || String(val).trim() === '';
    });
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}`
      });
    }
    next();
  };
}

/**
 * Validate email format
 */
function validateEmail(req, res, next) {
  const email = req.body.email;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: 'Invalid email address.' });
  }
  next();
}

/**
 * Sanitize string inputs — trim and strip dangerous HTML
 */
function sanitizeInputs(req, res, next) {
  function clean(val) {
    if (typeof val !== 'string') return val;
    return val.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }

  function deepClean(obj) {
    if (typeof obj === 'string') return clean(obj);
    if (Array.isArray(obj)) return obj.map(deepClean);
    if (obj && typeof obj === 'object') {
      return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, deepClean(v)]));
    }
    return obj;
  }

  req.body = deepClean(req.body);
  next();
}

module.exports = { requireFields, validateEmail, sanitizeInputs };
