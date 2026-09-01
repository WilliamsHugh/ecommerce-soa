import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import app from "../src/app.js";
import { clearStore } from "../src/stores/product.store.js";

const secret = process.env.JWT_ACCESS_SECRET || "development-secret-change-me";
const token = (sub, roles) =>
  jwt.sign({ sub, roles }, secret, {
    expiresIn: "1h",
    issuer: "ecommerce-user-service",
    audience: "ecommerce-api",
  });
const body = (value, auth) => ({
  headers: {
    "content-type": "application/json",
    ...(auth ? { authorization: `Bearer ${auth}` } : {}),
  },
  body: JSON.stringify(value),
});
let server;
let baseUrl;
const call = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, options);
  return { response, body: response.status === 204 ? null : await response.json() };
};

test.before(async () => {
  clearStore();
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => new Promise((resolve) => server.close(resolve)));

test("catalog validates RBAC, filters, searches, updates and soft deletes", async () => {
  const seller = token("seller-1", ["SELLER"]);
  assert.equal(
    (
      await call("/api/v1/products", {
        method: "POST",
        ...body({ name: "", sku: "bad sku", category: "Laptop", price: -1, stock: 1 }, seller),
      })
    ).response.status,
    400,
  );
  const created = await call("/api/v1/products", {
    method: "POST",
    ...body(
      {
        name: "Laptop Pro",
        sku: "LAP-001",
        category: "Laptops",
        price: 15000000,
        stock: 5,
        description: "Fast computer",
      },
      seller,
    ),
  });
  assert.equal(created.response.status, 201);
  const id = created.body.data.id;
  assert.equal(
    (
      await call("/api/v1/products", {
        method: "POST",
        ...body(
          { name: "Duplicate", sku: "lap-001", category: "Laptops", price: 1, stock: 1 },
          seller,
        ),
      })
    ).response.status,
    409,
  );
  assert.equal((await call("/api/v1/products/search?q=computer")).body.data.length, 1);
  const listed = await call("/api/v1/products?category=Laptops&min_price=10000000&page=1&limit=1");
  assert.equal(listed.body.pagination.total, 1);
  assert.equal((await call(`/api/v1/products/${id}`)).response.status, 200);
  assert.equal(
    (
      await call(`/api/v1/products/${id}`, {
        method: "PUT",
        ...body({ price: 16000000 }, token("other", ["SELLER"])),
      })
    ).response.status,
    403,
  );
  assert.equal(
    (await call(`/api/v1/products/${id}`, { method: "PUT", ...body({ price: 16000000 }, seller) }))
      .response.status,
    200,
  );
  assert.equal(
    (
      await call(`/api/v1/products/${id}/images/presign`, {
        method: "POST",
        ...body({ filename: "x.png", content_type: "image/png", size: 12 }, seller),
      })
    ).response.status,
    503,
  );
  assert.equal(
    (
      await call(`/api/v1/products/${id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${seller}` },
      })
    ).response.status,
    204,
  );
  assert.equal((await call(`/api/v1/products/${id}`)).response.status, 404);
});

test("inventory reservations are concurrency-safe and ownership-protected", async () => {
  const seller = token("seller-2", ["SELLER"]);
  const buyer = token("buyer-1", ["BUYER"]);
  const created = await call("/api/v1/products", {
    method: "POST",
    ...body(
      { name: "Keyboard", sku: "KEY-001", category: "Accessories", price: 100, stock: 5 },
      seller,
    ),
  });
  const id = created.body.data.id;
  const results = await Promise.all(
    [1, 2, 3].map(() =>
      call("/api/v1/inventory/reserve", {
        method: "POST",
        ...body({ items: [{ product_id: id, quantity: 2 }] }, buyer),
      }),
    ),
  );
  assert.equal(results.filter(({ response }) => response.status === 201).length, 2);
  assert.equal(results.filter(({ response }) => response.status === 409).length, 1);
  const reservation = results.find(({ response }) => response.status === 201).body.data;
  assert.equal(
    (
      await call(`/api/v1/inventory/reservations/${reservation.id}/release`, {
        method: "POST",
        headers: { authorization: `Bearer ${token("other", ["BUYER"])}` },
      })
    ).response.status,
    403,
  );
  assert.equal(
    (
      await call(`/api/v1/inventory/reservations/${reservation.id}/release`, {
        method: "POST",
        headers: { authorization: `Bearer ${buyer}` },
      })
    ).response.status,
    200,
  );
  assert.equal(
    (
      await call(`/api/v1/inventory/reservations/${reservation.id}/release`, {
        method: "POST",
        headers: { authorization: `Bearer ${buyer}` },
      })
    ).response.status,
    404,
  );
  const product = await call(`/api/v1/products/${id}`);
  assert.equal(product.body.data.available_stock, 3);
});
