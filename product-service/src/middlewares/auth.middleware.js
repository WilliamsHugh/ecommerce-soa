import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const authenticate =
  (roles = []) =>
  (req, res, next) => {
    try {
      const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
      req.auth = jwt.verify(token, env.accessSecret, {
        algorithms: ["HS256"],
        issuer: env.jwtIssuer,
        audience: env.jwtAudience,
      });
      if (roles.length && !req.auth.roles.some((role) => roles.includes(role))) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      next();
    } catch {
      res.status(401).json({ error: "Invalid or missing token" });
    }
  };
