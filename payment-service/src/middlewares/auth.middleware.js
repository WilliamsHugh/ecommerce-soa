import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function authenticate(req, res, next) {
  try {
    req.auth = jwt.verify(
      req.headers.authorization?.replace(/^Bearer\s+/i, ""),
      env.jwtSecret,
      {
        algorithms: ["HS256"],
        issuer: env.jwtIssuer,
        audience: env.jwtAudience,
      },
    );
    req.auth.roles = Array.isArray(req.auth.roles) ? req.auth.roles : [];
    next();
  } catch {
    res.status(401).json({ error: "Invalid or missing token" });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.auth.roles.includes("ADMIN"))
    return res.status(403).json({ error: "Admin role required" });
  next();
}
