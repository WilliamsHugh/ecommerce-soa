import test from "node:test";
import assert from "node:assert/strict";
import { pool, closeDatabase } from "../src/config/database.js";
import { closeRedis } from "../src/config/redis.js";

const enabled = process.env.RUN_INTEGRATION === "true";
const baseUrl = process.env.INTEGRATION_BASE_URL || "http://127.0.0.1:3001";

test(
  "real MySQL and Redis: register, authenticate and revoke all sessions",
  { skip: !enabled },
  async () => {
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    let userId;
    try {
      const registeredResponse = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: `integration-${unique}@example.com`,
          username: `integration_${unique}`.slice(0, 100),
          password: "integrationPassword123",
        }),
      });
      assert.equal(registeredResponse.status, 201);
      const registered = await registeredResponse.json();
      userId = registered.data.id;

      const profileResponse = await fetch(`${baseUrl}/api/v1/users/me`, {
        headers: { authorization: `Bearer ${registered.access_token}` },
      });
      assert.equal(profileResponse.status, 200);

      const logoutResponse = await fetch(`${baseUrl}/api/v1/auth/logout-all`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${registered.access_token}`,
        },
        body: "{}",
      });
      assert.equal(logoutResponse.status, 204);
      assert.equal(
        (
          await fetch(`${baseUrl}/api/v1/users/me`, {
            headers: { authorization: `Bearer ${registered.access_token}` },
          })
        ).status,
        401,
      );
    } finally {
      if (userId && pool) await pool.execute("DELETE FROM users WHERE id = ?", [userId]);
      await Promise.all([closeDatabase(), closeRedis()]);
    }
  },
);
