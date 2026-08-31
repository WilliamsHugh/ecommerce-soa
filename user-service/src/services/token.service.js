import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { connectRedis, redis } from "../config/redis.js";

const memoryRefreshTokens = new Map();
const memoryBlacklist = new Map();
const memoryPasswordResets = new Map();
const key = (suffix) => `${env.redisKeyPrefix}${suffix}`;
const ttlFromPayload = (payload) => Math.max(1, payload.exp - Math.floor(Date.now() / 1000));

export async function issueTokens(user) {
  const accessJti = randomUUID();
  const refreshJti = randomUUID();
  const claims = {
    sub: user.id,
    email: user.email,
    roles: user.roles,
    token_version: user.token_version || 0,
  };
  const accessToken = jwt.sign({ ...claims, jti: accessJti }, env.accessSecret, {
    expiresIn: env.accessTtl,
    issuer: env.jwtIssuer,
    audience: env.jwtAudience,
  });
  const refreshToken = jwt.sign(
    { sub: user.id, type: "refresh", jti: refreshJti },
    env.refreshSecret,
    { expiresIn: env.refreshTtl, issuer: env.jwtIssuer, audience: env.jwtAudience },
  );
  const refreshPayload = jwt.decode(refreshToken);
  const ttl = ttlFromPayload(refreshPayload);

  if (redis) {
    await connectRedis();
    await redis.set(key(`refresh:${refreshJti}`), user.id, { EX: ttl });
    await redis.sAdd(key(`user-refresh:${user.id}`), refreshJti);
    await redis.expire(key(`user-refresh:${user.id}`), ttl);
  } else {
    memoryRefreshTokens.set(refreshJti, { userId: user.id, expiresAt: refreshPayload.exp });
  }
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: jwt.decode(accessToken).exp - Math.floor(Date.now() / 1000),
  };
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.refreshSecret, {
    algorithms: ["HS256"],
    issuer: env.jwtIssuer,
    audience: env.jwtAudience,
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.accessSecret, {
    algorithms: ["HS256"],
    issuer: env.jwtIssuer,
    audience: env.jwtAudience,
  });
}

export async function consumeRefreshToken(payload) {
  if (payload.type !== "refresh" || !payload.jti) return false;
  if (redis) {
    await connectRedis();
    const storedUserId = await redis.getDel(key(`refresh:${payload.jti}`));
    await redis.sRem(key(`user-refresh:${payload.sub}`), payload.jti);
    return storedUserId === payload.sub;
  }
  const session = memoryRefreshTokens.get(payload.jti);
  memoryRefreshTokens.delete(payload.jti);
  return session?.userId === payload.sub && session.expiresAt > Date.now() / 1000;
}

export async function revokeRefreshToken(token) {
  try {
    const payload = verifyRefreshToken(token);
    return consumeRefreshToken(payload);
  } catch {
    return false;
  }
}

export async function blacklistAccessToken(payload) {
  if (!payload?.jti || !payload.exp) return;
  const ttl = ttlFromPayload(payload);
  if (redis) {
    await connectRedis();
    await redis.set(key(`blacklist:${payload.jti}`), "1", { EX: ttl });
  } else {
    memoryBlacklist.set(payload.jti, payload.exp);
  }
}

export async function isAccessTokenBlacklisted(jti) {
  if (!jti) return false;
  if (redis) {
    await connectRedis();
    return (await redis.exists(key(`blacklist:${jti}`))) === 1;
  }
  const expiry = memoryBlacklist.get(jti);
  if (expiry && expiry <= Date.now() / 1000) memoryBlacklist.delete(jti);
  return Boolean(expiry && expiry > Date.now() / 1000);
}

export async function revokeAllRefreshTokens(userId) {
  if (redis) {
    await connectRedis();
    const setKey = key(`user-refresh:${userId}`);
    const tokenIds = await redis.sMembers(setKey);
    if (tokenIds.length) await redis.del(tokenIds.map((id) => key(`refresh:${id}`)));
    await redis.del(setKey);
  } else {
    for (const [id, session] of memoryRefreshTokens) {
      if (session.userId === userId) memoryRefreshTokens.delete(id);
    }
  }
}

export async function createPasswordResetToken(userId) {
  const token = randomUUID();
  if (redis) {
    await connectRedis();
    await redis.set(key(`password-reset:${token}`), userId, { EX: env.passwordResetTtlSeconds });
  } else {
    memoryPasswordResets.set(token, {
      userId,
      expiresAt: Date.now() + env.passwordResetTtlSeconds * 1000,
    });
  }
  return token;
}

export async function consumePasswordResetToken(token) {
  if (redis) {
    await connectRedis();
    return redis.getDel(key(`password-reset:${token}`));
  }
  const record = memoryPasswordResets.get(token);
  memoryPasswordResets.delete(token);
  return record?.expiresAt > Date.now() ? record.userId : null;
}
