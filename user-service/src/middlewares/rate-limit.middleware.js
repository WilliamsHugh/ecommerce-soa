import { env } from "../config/env.js";
import { connectRedis, redis } from "../config/redis.js";

const memoryAttempts = new Map();

export async function loginRateLimit(req, res, next) {
  const identity = `${req.ip}:${String(req.body?.email || "").toLowerCase()}`;
  const key = `${env.redisKeyPrefix}rate:login:${identity}`;
  try {
    let attempts;
    if (redis) {
      await connectRedis();
      attempts = await redis.incr(key);
      if (attempts === 1) await redis.expire(key, env.loginRateWindowSeconds);
    } else {
      const now = Date.now();
      const current = memoryAttempts.get(key);
      const record =
        !current || current.expiresAt <= now
          ? { count: 1, expiresAt: now + env.loginRateWindowSeconds * 1000 }
          : { ...current, count: current.count + 1 };
      memoryAttempts.set(key, record);
      attempts = record.count;
    }
    if (attempts > env.loginRateLimit) {
      res.set("Retry-After", String(env.loginRateWindowSeconds));
      return res.status(429).json({ error: "Too many login attempts" });
    }
    next();
  } catch (error) {
    next(error);
  }
}
