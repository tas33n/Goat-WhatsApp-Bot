const config = require("../../config.json");

// Simple in-memory session storage
const dashboardSessions = new Map();

function generateSessionId() {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

function isValidSession(sessionId) {
  const session = dashboardSessions.get(sessionId);
  if (!session) return false;
  const now = Date.now();
  if (now - session.createdAt > (config.dashboard.sessionTimeout || 1800000)) {
    dashboardSessions.delete(sessionId);
    return false;
  }
  return true;
}

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token) {
    const authTokens = global.GoatBot.authTokens || new Map();
    const tokenData = authTokens.get(token);
    if (tokenData && Date.now() <= tokenData.expiryTime) {
      req.user = { authenticated: true };
      return next();
    }
    if (tokenData) authTokens.delete(token);
  }
  const sessionId = req.headers["x-session-id"] || req.query.sessionId;
  if (!sessionId || !isValidSession(sessionId)) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

module.exports = {
  dashboardSessions,
  generateSessionId,
  isValidSession,
  requireAuth,
};
