import { timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

export function authenticateInternal(req, res, next) {
  if (!env.internalServiceSecret) return next();
  const supplied = req.headers["x-internal-service-secret"] || "";
  const expected = Buffer.from(env.internalServiceSecret);
  const actual = Buffer.from(String(supplied));
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return res.status(401).json({ error: "Invalid internal service credentials" });
  return next();
}
