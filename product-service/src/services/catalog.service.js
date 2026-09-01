import { env } from "../config/env.js";
import { checkMongo } from "../config/mongodb.js";

export async function checkCatalogStore() {
  return env.productStoreDriver === "mongodb" ? checkMongo() : true;
}

export async function checkImageStore() {
  if (!env.s3HealthUrl) return true;
  const response = await fetch(env.s3HealthUrl, {
    method: "HEAD",
    signal: AbortSignal.timeout(2000),
  });
  return response.ok || response.status === 403;
}
