import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import {
  applyPayment,
  canAccess,
  changeStatus,
} from "../src/services/order.service.js";

const secret = "development-secret-change-me";
const auth = jwt.sign({ sub: "buyer-1", roles: ["BUYER"] }, secret, {
  issuer: "ecommerce-user-service",
  audience: "ecommerce-api",
});
let server;
let baseUrl;

test.before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => new Promise((resolve) => server.close(resolve)));

test("exposes health and protects order routes", async () => {
  const health = await fetch(`${baseUrl}/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, "ok");

  const unauthorized = await fetch(`${baseUrl}/api/v1/orders`);
  assert.equal(unauthorized.status, 401);

  const invalid = await fetch(`${baseUrl}/api/v1/orders`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${auth}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ items: [] }),
  });
  assert.equal(invalid.status, 400);
});

test("enforces ownership and order state transitions", async () => {
  const order = {
    id: "order-1",
    user_id: "buyer-1",
    status: "PENDING",
    total: 100,
    currency: "VND",
    items: [],
    shipping_address: "Hanoi",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  assert.equal(canAccess({ sub: "buyer-1", roles: ["BUYER"] }, order), true);
  assert.equal(canAccess({ sub: "other", roles: ["BUYER"] }, order), false);
  await changeStatus(order, "CONFIRMED", `Bearer ${auth}`);
  assert.equal(order.status, "CONFIRMED");
  await assert.rejects(
    changeStatus(order, "DELIVERED", `Bearer ${auth}`),
    /Invalid transition/,
  );
  applyPayment(order, "pay-1");
  assert.equal(order.payment_id, undefined);
});
