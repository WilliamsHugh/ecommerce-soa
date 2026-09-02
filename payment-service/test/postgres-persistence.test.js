import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

const execute = promisify(execFile);
const databaseUrl = process.env.TEST_DATABASE_URL;
const runNode = (source) =>
  execute(process.execPath, ["--input-type=module", "-e", source], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "test",
      PAYMENT_STORE_DRIVER: "postgres",
      DATABASE_URL: databaseUrl,
      PAYMENT_GATEWAY_PROVIDER: "soap_sandbox",
    },
  });

test(
  "PostgreSQL payment and idempotency survive a service process restart",
  {
    skip: !databaseUrl && "Set TEST_DATABASE_URL to run PostgreSQL integration",
  },
  async () => {
    const suffix = `${Date.now()}-${process.pid}`;
    const key = `restart-${suffix}`;
    const orderId = `order-${suffix}`;
    const createSource = `
      const { createPayment, applyCallback } = await import("./src/services/payment.service.js");
      const { paymentStore } = await import("./src/stores/payment.store.js");
      const result = await createPayment({order_id:${JSON.stringify(orderId)},amount:42,currency:"VND"},${JSON.stringify(key)},"postgres-user");
      await applyCallback(result.payment, ${JSON.stringify(`event-${key}`)}, "CAPTURED");
      process.stdout.write(result.payment.id);
      await paymentStore.close();
    `;
    const created = (await runNode(createSource)).stdout.trim();
    assert.match(created, /^[0-9a-f-]{36}$/);

    // A second Node process models the service being restarted with an empty module cache.
    const readSource = `
      const { paymentStore } = await import("./src/stores/payment.store.js");
      const payment = await paymentStore.findByKey(${JSON.stringify(key)},"postgres-user",${JSON.stringify(orderId)});
      if (!payment) process.exit(2);
      const outbox = await paymentStore.pendingOutbox();
      process.stdout.write(JSON.stringify({payment,outbox}));
      await paymentStore.close();
    `;
    const persisted = JSON.parse((await runNode(readSource)).stdout);
    assert.equal(persisted.payment.id, created);
    assert.equal(persisted.payment.amount, 42);
    assert.equal(persisted.payment.status, "CAPTURED");
    assert.equal(persisted.outbox[0].payload.order_id, orderId);
  },
);
