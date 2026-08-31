import { createClient } from "redis";
import { env } from "./env.js";

export const redis = env.useMemoryStores ? null : createClient({ url: env.redisUrl });
redis?.on("error", (error) => console.error("Redis error", error.message));

export async function connectRedis() {
  if (redis && !redis.isOpen) await redis.connect();
}
export async function checkRedis() {
  if (!redis) return true;
  await connectRedis();
  return (await redis.ping()) === "PONG";
}
export async function closeRedis() {
  if (redis?.isOpen) await redis.quit();
}
