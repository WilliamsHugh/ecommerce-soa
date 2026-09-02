import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import test from "node:test";
import jwt from "jsonwebtoken";

const jwtSecret = "test-secret-with-sufficient-entropy";

const upstream = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ status: "ok" }));
  }

  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        method: req.method,
        url: req.url,
        body: Buffer.concat(chunks).toString(),
        requestId: req.headers["x-request-id"],
      }),
    );
  });
});

upstream.listen(0, "127.0.0.1");
await once(upstream, "listening");
const upstreamUrl = `http://127.0.0.1:${upstream.address().port}`;

process.env.JWT_ACCESS_SECRET = jwtSecret;
process.env.JWT_ISSUER = "test-user-service";
process.env.JWT_AUDIENCE = "test-api";
process.env.USER_SERVICE_URL = upstreamUrl;
process.env.PRODUCT_SERVICE_URL = upstreamUrl;
process.env.ORDER_SERVICE_URL = upstreamUrl;
process.env.PAYMENT_SERVICE_URL = upstreamUrl;
process.env.NOTIFICATION_SERVICE_URL = upstreamUrl;

const { default: app } = await import("../src/app.js");
const gateway = app.listen(0, "127.0.0.1");
await once(gateway, "listening");
const gatewayUrl = `http://127.0.0.1:${gateway.address().port}`;

test.after(() => {
  gateway.close();
  upstream.close();
});

test("exposes liveness and aggregate readiness", async () => {
  const health = await fetch(`${gatewayUrl}/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, "ok");

  const ready = await fetch(`${gatewayUrl}/ready`);
  assert.equal(ready.status, 200);
  const payload = await ready.json();
  assert.equal(payload.status, "ready");
  assert.deepEqual(payload.upstreams, {
    user: "up",
    product: "up",
    order: "up",
    payment: "up",
    notification: "up",
  });
});

test("proxies an exact public auth route and preserves its body", async () => {
  const response = await fetch(`${gatewayUrl}/api/v1/auth/login?source=test`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": "request-1" },
    body: JSON.stringify({ email: "user@example.com", password: "secret" }),
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.method, "POST");
  assert.equal(payload.url, "/api/v1/auth/login?source=test");
  assert.deepEqual(JSON.parse(payload.body), {
    email: "user@example.com",
    password: "secret",
  });
  assert.equal(payload.requestId, "request-1");
});

test("rejects protected routes without a token", async () => {
  const response = await fetch(`${gatewayUrl}/api/v1/orders`);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "Missing bearer token");
});

test("accepts a valid token and proxies a protected route", async () => {
  const token = jwt.sign(
    { sub: "user-1", roles: ["BUYER"] },
    jwtSecret,
    { algorithm: "HS256", issuer: "test-user-service", audience: "test-api" },
  );
  const response = await fetch(`${gatewayUrl}/api/v1/orders`, {
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.url, "/api/v1/orders");
  assert.match(payload.requestId, /^[0-9a-f-]{36}$/);
});

test("returns 404 for an unknown resource", async () => {
  const token = jwt.sign({ sub: "user-1" }, jwtSecret, {
    algorithm: "HS256",
    issuer: "test-user-service",
    audience: "test-api",
  });
  const response = await fetch(`${gatewayUrl}/api/v1/unknown`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "Unknown service route");
});
