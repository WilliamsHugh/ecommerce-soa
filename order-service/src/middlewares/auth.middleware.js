import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function authenticate(req, res, next) {
  try {
    req.token = req.headers.authorization;
    req.auth = jwt.verify(
      req.token?.replace(/^Bearer\s+/i, ""),
      env.jwtSecret,
      {
        algorithms: ["HS256"],
        issuer: env.jwtIssuer,
        audience: env.jwtAudience,
      },
    );
    next();
  } catch {
    res.status(401).json({ error: "Invalid or missing token" });
  }
}
