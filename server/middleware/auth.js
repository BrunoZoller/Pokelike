// Validates Authorization: Bearer <uuid> header.
// The UUID from the cloud-save server is treated as an opaque session secret.
// No local user-table lookup needed — possession of the UUID is the credential.

function requireAuth(db) {
  return (req, res, next) => {
    const header = req.headers['authorization'] || '';
    const uuid = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!uuid || uuid.length < 8) return res.status(401).json({ error: 'Missing auth token' });
    req.userId = uuid;
    req.db = db;
    next();
  };
}

module.exports = { requireAuth };
