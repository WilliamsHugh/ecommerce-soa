import { env } from "../config/env.js";
import { elasticsearchBaseUrl, elasticsearchHeaders } from "../config/elasticsearch.js";

export async function checkCatalogStore() {
  if (env.productStoreDriver !== "elasticsearch") return true;
  const response = await fetch(`${elasticsearchBaseUrl}/_cluster/health`, {
    headers: elasticsearchHeaders,
    signal: AbortSignal.timeout(2000),
  });
  return response.ok;
}

export async function checkImageStore() {
  if (!env.s3HealthUrl) return true;
  const response = await fetch(env.s3HealthUrl, {
    method: "HEAD",
    signal: AbortSignal.timeout(2000),
  });
  return response.ok || response.status === 403;
}
