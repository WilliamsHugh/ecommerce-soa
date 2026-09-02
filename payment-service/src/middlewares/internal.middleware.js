import { timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

export function authenticateInternal(req, res, next) {
  if (!env.internalServiceSecret && env.nodeEnv !== "production") return next();
  const expected = Buffer.from(env.internalServiceSecret);
  const actual = Buffer.from(
    String(req.headers["x-internal-service-secret"] || ""),
  );
  if (
    !expected.length ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    return res
      .status(401)
      .json({ error: "Invalid internal service credentials" });
  next();
}
