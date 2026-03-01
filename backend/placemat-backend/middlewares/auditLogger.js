/**
 * PLACEMAT — middlewares/auditLogger.js
 * Logs important actions to audit_logs table
 */

const { getDb } = require('../database/db');

function auditLog(action, entity, entityIdFn = null, detailsFn = null) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function (data) {
      if (data && data.success && req.user) {
        try {
          const db       = getDb();
          const entityId = typeof entityIdFn === 'function' ? entityIdFn(req, data) : null;
          const details  = typeof detailsFn  === 'function' ? JSON.stringify(detailsFn(req, data)) : null;
          db.prepare(`
            INSERT INTO audit_logs (user_id, user_role, action, entity, entity_id, details, ip_address)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            req.user.id,
            req.user.role,
            action,
            entity,
            entityId,
            details,
            req.ip || req.connection?.remoteAddress
          );
        } catch (e) {
          console.error('Audit log error:', e.message);
        }
      }
      return originalJson(data);
    };
    next();
  };
}

module.exports = { auditLog };
