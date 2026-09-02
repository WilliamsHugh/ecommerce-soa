import { env } from "../config/env.js";

const clients = new Map();

export function rateLimit(req, res, next) {
  const key = req.headers.authorization || req.ip;
  const now = Date.now();
  let entry = clients.get(key);

  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + env.rateLimitWindowMs };
    clients.set(key, entry);
  }

  entry.count += 1;
  res.setHeader("x-ratelimit-limit", env.rateLimitMax);
  res.setHeader("x-ratelimit-remaining", Math.max(0, env.rateLimitMax - entry.count));
  res.setHeader("x-ratelimit-reset", Math.ceil(entry.resetAt / 1000));

  if (entry.count > env.rateLimitMax) {
    res.setHeader("retry-after", Math.ceil((entry.resetAt - now) / 1000));
    return res.status(429).json({
      error: "Rate limit exceeded",
      request_id: req.requestId,
    });
  }
  return next();
}

export function clearExpiredRateLimits(now = Date.now()) {
  for (const [key, entry] of clients) {
    if (now >= entry.resetAt) clients.delete(key);
  }
}

const cleanup = setInterval(clearExpiredRateLimits, env.rateLimitWindowMs);
cleanup.unref();
