import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function authenticate(req, res, next) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    req.auth = jwt.verify(token, env.jwtSecret, {
      algorithms: ["HS256"],
      issuer: env.jwtIssuer,
      audience: env.jwtAudience,
    });
    next();
  } catch {
    res.status(401).json({ error: "Invalid or missing token" });
  }
}

export function authenticateInternal(req, res, next) {
  if (!env.internalServiceSecret) return next();
  if (req.headers["x-internal-service-secret"] !== env.internalServiceSecret)
    return res
      .status(401)
      .json({ error: "Invalid internal service credentials" });
  return next();
}
