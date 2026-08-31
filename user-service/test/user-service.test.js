import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import app from "../src/app.js";
import { issueTokens } from "../src/services/token.service.js";
import { userStore } from "../src/stores/user.store.js";

let server;
let baseUrl;
const json = (body, token) => ({
  headers: {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify(body),
});
const call = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, options);
  return { response, body: response.status === 204 ? null : await response.json() };
};

test.before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => new Promise((resolve) => server.close(resolve)));

test("health, validation, register, login, refresh rotation and logout", async () => {
  assert.equal((await call("/health")).response.status, 200);
  assert.equal((await call("/missing")).response.status, 404);
  const invalid = await call("/api/v1/auth/register", {
    method: "POST",
    ...json({ email: "invalid", username: "x", password: "short" }),
  });
  assert.equal(invalid.response.status, 400);
  const registered = await call("/api/v1/auth/register", {
    method: "POST",
    ...json({ email: "user@example.com", username: "user_name", password: "password123" }),
  });
  assert.equal(registered.response.status, 201);
  assert.equal(registered.body.data.password_hash, undefined);
  assert.equal(typeof registered.body.data.id, "string");
  assert.equal(
    (
      await call("/api/v1/auth/register", {
        method: "POST",
        ...json({ email: "user@example.com", username: "another", password: "password123" }),
      })
    ).response.status,
    409,
  );
  assert.equal(
    (
      await call("/api/v1/auth/login", {
        method: "POST",
        ...json({ email: "user@example.com", password: "wrong" }),
      })
    ).response.status,
    401,
  );
  assert.equal(
    (
      await call("/api/v1/users/me", {
        headers: { authorization: `Bearer ${registered.body.access_token}` },
      })
    ).body.data.id,
    registered.body.data.id,
  );
  const refreshed = await call("/api/v1/auth/refresh", {
    method: "POST",
    ...json({ refresh_token: registered.body.refresh_token }),
  });
  assert.equal(refreshed.response.status, 200);
  assert.equal(
    (
      await call("/api/v1/auth/refresh", {
        method: "POST",
        ...json({ refresh_token: registered.body.refresh_token }),
      })
    ).response.status,
    401,
  );
  assert.equal(
    (
      await call("/api/v1/auth/logout", {
        method: "POST",
        ...json({ refresh_token: refreshed.body.refresh_token }, refreshed.body.access_token),
      })
    ).response.status,
    204,
  );
  assert.equal(
    (
      await call("/api/v1/users/me", {
        headers: { authorization: `Bearer ${refreshed.body.access_token}` },
      })
    ).response.status,
    401,
  );
});

test("change, forgot and reset password revoke existing access tokens", async () => {
  const login = await call("/api/v1/auth/login", {
    method: "POST",
    ...json({ email: "user@example.com", password: "password123" }),
  });
  assert.equal(
    (
      await call("/api/v1/auth/change-password", {
        method: "POST",
        ...json(
          { current_password: "wrong", new_password: "newPassword123" },
          login.body.access_token,
        ),
      })
    ).response.status,
    400,
  );
  assert.equal(
    (
      await call("/api/v1/auth/change-password", {
        method: "POST",
        ...json(
          { current_password: "password123", new_password: "newPassword123" },
          login.body.access_token,
        ),
      })
    ).response.status,
    204,
  );
  assert.equal(
    (
      await call("/api/v1/users/me", {
        headers: { authorization: `Bearer ${login.body.access_token}` },
      })
    ).response.status,
    401,
  );
  const forgotUnknown = await call("/api/v1/auth/forgot-password", {
    method: "POST",
    ...json({ email: "nobody@example.com" }),
  });
  assert.equal(forgotUnknown.response.status, 202);
  assert.equal(forgotUnknown.body.reset_token, undefined);
  const forgot = await call("/api/v1/auth/forgot-password", {
    method: "POST",
    ...json({ email: "user@example.com" }),
  });
  assert.equal(typeof forgot.body.reset_token, "string");
  assert.equal(
    (
      await call("/api/v1/auth/reset-password", {
        method: "POST",
        ...json({ reset_token: forgot.body.reset_token, new_password: "resetPassword123" }),
      })
    ).response.status,
    204,
  );
  assert.equal(
    (
      await call("/api/v1/auth/reset-password", {
        method: "POST",
        ...json({ reset_token: forgot.body.reset_token, new_password: "anotherPassword123" }),
      })
    ).response.status,
    400,
  );
  assert.equal(
    (
      await call("/api/v1/auth/login", {
        method: "POST",
        ...json({ email: "user@example.com", password: "resetPassword123" }),
      })
    ).response.status,
    200,
  );
});

test("RBAC administration, pagination, roles, status and audit", async () => {
  const admin = await userStore.create({
    id: randomUUID(),
    email: "admin@example.com",
    username: "admin_test",
    password_hash: await bcrypt.hash("adminPassword123", 12),
    roles: ["ADMIN"],
    status: "ACTIVE",
    token_version: 0,
  });
  const adminTokens = await issueTokens(admin);
  const user = await userStore.findByEmail("user@example.com");
  const userLogin = await call("/api/v1/auth/login", {
    method: "POST",
    ...json({ email: user.email, password: "resetPassword123" }),
  });
  assert.equal(
    (
      await call("/api/v1/users", {
        headers: { authorization: `Bearer ${userLogin.body.access_token}` },
      })
    ).response.status,
    403,
  );
  const listed = await call("/api/v1/users?page=1&limit=1&status=ACTIVE&search=user", {
    headers: { authorization: `Bearer ${adminTokens.access_token}` },
  });
  assert.equal(listed.response.status, 200);
  assert.equal(listed.body.meta.limit, 1);
  assert.ok(listed.body.meta.total >= 1);
  assert.equal(
    (
      await call(`/api/v1/users/${user.id}/roles`, {
        method: "POST",
        ...json({ role: "SELLER" }, adminTokens.access_token),
      })
    ).response.status,
    201,
  );
  assert.equal(
    (
      await call("/api/v1/users/me", {
        headers: { authorization: `Bearer ${userLogin.body.access_token}` },
      })
    ).response.status,
    401,
  );
  const freshAdmin = await issueTokens(await userStore.findById(admin.id));
  assert.equal(
    (
      await call(`/api/v1/users/${user.id}/roles`, {
        method: "DELETE",
        ...json({ role: "SELLER" }, freshAdmin.access_token),
      })
    ).response.status,
    200,
  );
  assert.equal(
    (
      await call(`/api/v1/users/${user.id}/roles`, {
        method: "DELETE",
        ...json({ role: "BUYER" }, freshAdmin.access_token),
      })
    ).response.status,
    409,
  );
  assert.equal(
    (
      await call(`/api/v1/users/${user.id}`, {
        method: "PUT",
        ...json({ status: "BANNED" }, freshAdmin.access_token),
      })
    ).response.status,
    200,
  );
  assert.equal(
    (
      await call("/api/v1/auth/login", {
        method: "POST",
        ...json({ email: user.email, password: "resetPassword123" }),
      })
    ).response.status,
    401,
  );
  assert.equal(
    (
      await call("/api/v1/users/audit-logs", {
        headers: { authorization: `Bearer ${freshAdmin.access_token}` },
      })
    ).response.status,
    200,
  );
  assert.equal(
    (
      await call(`/api/v1/users/${admin.id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${freshAdmin.access_token}` },
      })
    ).response.status,
    409,
  );
});
