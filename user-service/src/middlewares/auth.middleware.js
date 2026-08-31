import { isAccessTokenBlacklisted, verifyAccessToken } from "../services/token.service.js";
import { userStore } from "../stores/user.store.js";

export async function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Bearer token is required" });
  try {
    const payload = verifyAccessToken(token);
    if (await isAccessTokenBlacklisted(payload.jti)) {
      return res.status(401).json({ error: "Token has been revoked" });
    }
    const user = await userStore.findById(payload.sub);
    if (!user || user.status !== "ACTIVE" || (user.token_version || 0) !== payload.token_version) {
      return res.status(401).json({ error: "Account disabled or token has been revoked" });
    }
    payload.roles = user.roles;
    req.auth = payload;
    req.accessToken = token;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export const authorize =
  (...roles) =>
  (req, res, next) =>
    req.auth?.roles?.some((role) => roles.includes(role))
      ? next()
      : res.status(403).json({ error: "Insufficient permissions" });
