import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import jwt from "jsonwebtoken";

process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test-secret";
process.env.INTERNAL_SERVICE_SECRET = "internal-test-secret";
process.env.DEPENDENCY_RETRIES = "1";
const { default: app } = await import("../src/app.js");
const { paymentStore } = await import("../src/stores/payment.store.js");
const { notifyOrderPaymentSuccess } =
  await import("../src/services/order-client.service.js");
const { initializeGatewayPayment } =
  await import("../src/services/gateway.service.js");
const { env } = await import("../src/config/env.js");
let server;
let base;
const token = (sub = "user-1", roles = ["BUYER"]) =>
  jwt.sign({ sub, roles }, "test-secret", {
    algorithm: "HS256",
    issuer: "ecommerce-user-service",
    audience: "ecommerce-api",
    expiresIn: "1h",
  });
const request = (path, options = {}) => fetch(`${base}${path}`, options);
const jsonHeaders = (auth = token()) => ({
  "content-type": "application/json",
  authorization: `Bearer ${auth}`,
});

before(
  () =>
    new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        base = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    }),
);
beforeEach(() => paymentStore.clear());
after(() => new Promise((resolve) => server.close(resolve)));

test("health and readiness are public", async () => {
  const health = await request("/health");
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("x-content-type-options"), "nosniff");
  assert.equal((await request("/ready")).status, 200);
});

test("CORS only permits configured origins", async () => {
  const allowed = await request("/health", {
    headers: { origin: "http://localhost:3000" },
  });
  assert.equal(
    allowed.headers.get("access-control-allow-origin"),
    "http://localhost:3000",
  );
  const denied = await request("/health", {
    headers: { origin: "https://untrusted.example" },
  });
  assert.equal(denied.status, 403);
});

test("payment APIs require a valid JWT and validate input", async () => {
  assert.equal(
    (await request("/api/v1/payments/00000000-0000-4000-8000-000000000000"))
      .status,
    401,
  );
  const response = await request("/api/v1/payments", {
    method: "POST",
    headers: { ...jsonHeaders(), "idempotency-key": "key-validation" },
    body: JSON.stringify({ order_id: "order-1", amount: -1, currency: "VN" }),
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Validation failed");
});

test("same scoped idempotency request returns the original payment", async () => {
  const options = {
    method: "POST",
    headers: { ...jsonHeaders(), "idempotency-key": "key-1" },
    body: JSON.stringify({
      order_id: "order-1",
      amount: 100.5,
      currency: "vnd",
    }),
  };
  const first = await request("/api/v1/payments", options);
  const second = await request("/api/v1/payments", options);
  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal((await first.json()).data.id, (await second.json()).data.id);
});

test("ownership is enforced while ADMIN can query all payments for an order", async () => {
  const created = await request("/api/v1/payments", {
    method: "POST",
    headers: { ...jsonHeaders(), "idempotency-key": "key-owner" },
    body: JSON.stringify({ order_id: "order-owner", amount: 10 }),
  });
  const payment = (await created.json()).data;
  assert.equal(
    (
      await request(`/api/v1/payments/${payment.id}`, {
        headers: jsonHeaders(token("other")),
      })
    ).status,
    403,
  );
  const admin = await request("/api/v1/payments/order/order-owner", {
    headers: jsonHeaders(token("admin", ["ADMIN"])),
  });
  assert.equal((await admin.json()).data.length, 1);
});

test("callback is protected, deduplicated, and rejects an invalid transition", async () => {
  const created = await request("/api/v1/payments", {
    method: "POST",
    headers: { ...jsonHeaders(), "idempotency-key": "key-hook" },
    body: JSON.stringify({ order_id: "order-hook", amount: 10 }),
  });
  const payment = (await created.json()).data;
  const body = JSON.stringify({
    event_id: "event-1",
    payment_id: payment.id,
    status: "FAILED",
  });
  assert.equal(
    (
      await request("/api/v1/payments/callback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      })
    ).status,
    401,
  );
  const headers = {
    "content-type": "application/json",
    "x-internal-service-secret": "internal-test-secret",
  };
  const first = await request("/api/v1/payments/callback", {
    method: "POST",
    headers,
    body,
  });
  const duplicate = await request("/api/v1/payments/callback", {
    method: "POST",
    headers,
    body,
  });
  assert.equal(first.status, 200);
  assert.equal((await duplicate.json()).duplicate, true);
  const invalid = await request("/api/v1/payments/callback", {
    method: "POST",
    headers,
    body: JSON.stringify({
      event_id: "event-2",
      payment_id: payment.id,
      status: "AUTHORIZED",
    }),
  });
  assert.equal(invalid.status, 409);
});

test("captured payment can be refunded once and amount cannot exceed charge", async () => {
  const now = new Date().toISOString();
  const payment = await paymentStore.save({
    id: "00000000-0000-4000-8000-000000000001",
    user_id: "user-1",
    order_id: "order-refund",
    amount: 50,
    currency: "VND",
    status: "CAPTURED",
    gateway: "test",
    gateway_reference: "GW-test",
    idempotency_key: "refund-key",
    history: [{ status: "CAPTURED", at: now }],
    created_at: now,
    updated_at: now,
  });
  const tooMuch = await request(`/api/v1/payments/${payment.id}/refund`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ amount: 51 }),
  });
  assert.equal(tooMuch.status, 400);
  const refunded = await request(`/api/v1/payments/${payment.id}/refund`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ amount: 25 }),
  });
  assert.equal((await refunded.json()).data.status, "REFUNDED");
  assert.equal(
    (
      await request(`/api/v1/payments/${payment.id}/refund`, {
        method: "POST",
        headers: jsonHeaders(),
        body: "{}",
      })
    ).status,
    409,
  );
});

test("SOAP contract stays available and requires internal credentials", async () => {
  assert.match(
    await (await request("/soap/payment.wsdl")).text(),
    /PaymentPortType/,
  );
  const xml =
    "<Envelope><Body><orderId>soap-order</orderId><amount>20</amount><currency>VND</currency></Body></Envelope>";
  assert.equal(
    (
      await request("/soap/gateway", {
        method: "POST",
        headers: { "content-type": "text/xml", "idempotency-key": "soap-key" },
        body: xml,
      })
    ).status,
    401,
  );
  const response = await request("/soap/gateway", {
    method: "POST",
    headers: {
      "content-type": "text/xml",
      "idempotency-key": "soap-key",
      "x-internal-service-secret": "internal-test-secret",
    },
    body: xml,
  });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /<status>PENDING<\/status>/);
});

test("order callback retries 5xx but never retries 4xx", async () => {
  let attempts = 0;
  await assert.rejects(
    () =>
      notifyOrderPaymentSuccess({ id: "p", order_id: "o" }, async () => {
        attempts += 1;
        return { ok: false, status: 400 };
      }),
    /Unable to notify/,
  );
  assert.equal(attempts, 1);
  attempts = 0;
  await assert.rejects(
    () =>
      notifyOrderPaymentSuccess({ id: "p", order_id: "o" }, async () => {
        attempts += 1;
        return { ok: false, status: 503 };
      }),
    /Unable to notify/,
  );
  assert.equal(attempts, 2);
});

test("CAPTURED callback responds immediately and writes an order outbox message", async () => {
  const created = await request("/api/v1/payments", {
    method: "POST",
    headers: { ...jsonHeaders(), "idempotency-key": "key-outbox" },
    body: JSON.stringify({ order_id: "order-outbox", amount: 10 }),
  });
  const payment = (await created.json()).data;
  const response = await request("/api/v1/payments/callback", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-service-secret": "internal-test-secret",
    },
    body: JSON.stringify({
      event_id: "event-captured",
      payment_id: payment.id,
      status: "CAPTURED",
    }),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.status, "CAPTURED");
  const messages = await paymentStore.pendingOutbox();
  assert.equal(messages.length, 1);
  assert.equal(messages[0].payload.order_id, "order-outbox");
});

test("HTTP gateway adapter sends provider credentials", async () => {
  const previous = [env.gatewayProvider, env.gatewayApiUrl, env.gatewayApiKey];
  env.gatewayProvider = "http";
  env.gatewayApiUrl = "https://gateway.example/api/";
  env.gatewayApiKey = "provider-secret";
  try {
    const result = await initializeGatewayPayment(
      { order_id: "order-provider", amount: 99, currency: "USD" },
      "provider-key",
      async (url, options) => {
        assert.equal(url.href, "https://gateway.example/payments");
        assert.equal(options.headers.authorization, "Bearer provider-secret");
        return {
          ok: true,
          json: async () => ({
            reference: "provider-ref",
            status: "AUTHORIZED",
          }),
        };
      },
    );
    assert.equal(result.gateway_reference, "provider-ref");
    assert.equal(result.status, "AUTHORIZED");
  } finally {
    [env.gatewayProvider, env.gatewayApiUrl, env.gatewayApiKey] = previous;
  }
});
