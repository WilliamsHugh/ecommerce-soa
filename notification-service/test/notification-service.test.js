import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import { notificationStore } from "../src/stores/notification.store.js";

const token = jwt.sign(
  { sub: "buyer-1", roles: ["BUYER"] },
  "development-secret-change-me",
  {
    issuer: "ecommerce-user-service",
    audience: "ecommerce-api",
  },
);
let server;
let baseUrl;

test.before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => new Promise((resolve) => server.close(resolve)));

test("health, internal event validation and notification ownership", async () => {
  assert.equal((await fetch(`${baseUrl}/health`)).status, 200);
  assert.equal((await fetch(`${baseUrl}/ready`)).status, 200);
  const invalid = await fetch(`${baseUrl}/api/v1/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(invalid.status, 400);
  const event = await fetch(`${baseUrl}/api/v1/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      event_id: "event-1",
      type: "OrderCreated",
      data: { user_id: "buyer-1" },
    }),
  });
  assert.equal(event.status, 202);
  const duplicate = await fetch(`${baseUrl}/api/v1/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      event_id: "event-1",
      type: "OrderCreated",
      data: { user_id: "buyer-1" },
    }),
  });
  assert.equal((await duplicate.json()).duplicate, true);
  const list = await fetch(`${baseUrl}/api/v1/notifications`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal((await list.json()).data.length, 1);
  const forbidden = await fetch(
    `${baseUrl}/api/v1/notifications?recipient=other`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  assert.equal(forbidden.status, 403);
  assert.equal(notificationStore.findByRecipient("buyer-1").length, 1);
});
