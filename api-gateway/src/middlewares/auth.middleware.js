import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { isPublicRequest } from "../config/routes.js";

export function authenticate(req, res, next) {
  if (isPublicRequest(req)) return next();

  const match = req.headers.authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match)
    return res.status(401).json({
      error: "Missing bearer token",
      request_id: req.requestId,
    });

  try {
    req.auth = jwt.verify(match[1], env.jwtSecret, {
      algorithms: ["HS256"],
      issuer: env.jwtIssuer,
      audience: env.jwtAudience,
    });
    return next();
  } catch {
    return res.status(401).json({
      error: "Invalid or expired token",
      request_id: req.requestId,
    });
  }
}
