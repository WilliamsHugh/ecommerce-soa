import { env } from "../config/env.js";
import { resourceOwners } from "../config/routes.js";

const hopByHopHeaders = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function requestHeaders(req) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined && !hopByHopHeaders.has(key.toLowerCase()))
      headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  headers.set("x-request-id", req.requestId);
  headers.set("x-forwarded-host", req.headers.host || "");
  headers.set("x-forwarded-proto", req.protocol);
  return headers;
}

export async function proxyRequest(req, res) {
  const owner = resourceOwners[req.params.resource];
  const baseUrl = owner && env.services[owner];
  if (!baseUrl)
    return res.status(404).json({
      error: "Unknown service route",
      request_id: req.requestId,
    });

  try {
    const upstream = await fetch(`${baseUrl}${req.originalUrl}`, {
      method: req.method,
      headers: requestHeaders(req),
      body: ["GET", "HEAD"].includes(req.method) ? undefined : req.body,
      redirect: "manual",
      signal: AbortSignal.timeout(env.upstreamTimeoutMs),
    });

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (!hopByHopHeaders.has(key.toLowerCase())) res.setHeader(key, value);
    });
    res.setHeader("x-request-id", req.requestId);
    return res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    const timedOut = error.name === "TimeoutError";
    return res.status(timedOut ? 504 : 503).json({
      error: timedOut ? "Upstream timeout" : "Service unavailable",
      request_id: req.requestId,
    });
  }
}

export async function checkUpstreams() {
  const checks = await Promise.all(
    Object.entries(env.services).map(async ([name, baseUrl]) => {
      try {
        const response = await fetch(`${baseUrl}/health`, {
          signal: AbortSignal.timeout(env.readinessTimeoutMs),
        });
        return [name, response.ok ? "up" : "down"];
      } catch {
        return [name, "down"];
      }
    }),
  );
  return Object.fromEntries(checks);
}
