import { env } from "../config/env.js";
import { postgresPaymentStore } from "./postgres.store.js";

const payments = new Map();
const events = new Set();
const outbox = new Map();
const memoryStore = {
  async check() {
    return true;
  },
  async find(id) {
    return payments.get(id);
  },
  async findByGatewayReference(reference) {
    return [...payments.values()].find(
      (item) => item.gateway_reference === reference,
    );
  },
  async findByOrder(orderId, userId) {
    return [...payments.values()].filter(
      (item) =>
        item.order_id === orderId && (!userId || item.user_id === userId),
    );
  },
  async findByKey(key, userId, orderId) {
    return [...payments.values()].find(
      (item) =>
        item.idempotency_key === key &&
        item.user_id === userId &&
        item.order_id === orderId,
    );
  },
  async save(payment) {
    payments.set(payment.id, structuredClone(payment));
    return payment;
  },
  async saveWithOutbox(payment, message) {
    payments.set(payment.id, structuredClone(payment));
    if (!outbox.has(message.id))
      outbox.set(message.id, {
        ...structuredClone(message),
        attempts: 0,
        available_at: new Date().toISOString(),
      });
    return payment;
  },
  async pendingOutbox(limit = 20) {
    const now = Date.now();
    return [...outbox.values()]
      .filter((item) => new Date(item.available_at).getTime() <= now)
      .slice(0, limit)
      .map((item) => structuredClone(item));
  },
  async completeOutbox(id) {
    outbox.delete(id);
  },
  async retryOutbox(id, reason) {
    const item = outbox.get(id);
    if (!item) return;
    item.attempts += 1;
    item.last_error = reason;
    item.available_at = new Date(
      Date.now() + Math.min(60_000, 1000 * 2 ** item.attempts),
    ).toISOString();
  },
  async claimEvent(eventId) {
    if (events.has(eventId)) return false;
    events.add(eventId);
    return true;
  },
  async applyCallback(payment, eventId, message) {
    if (events.has(eventId)) return false;
    events.add(eventId);
    payments.set(payment.id, structuredClone(payment));
    if (message && !outbox.has(message.id))
      outbox.set(message.id, {
        ...structuredClone(message),
        attempts: 0,
        available_at: new Date().toISOString(),
      });
    return true;
  },
  async clear() {
    payments.clear();
    events.clear();
    outbox.clear();
  },
  async close() {},
};
const selected = () =>
  env.paymentStoreDriver === "postgres" ? postgresPaymentStore : memoryStore;
export const paymentStore = Object.fromEntries(
  [
    "check",
    "find",
    "findByGatewayReference",
    "findByOrder",
    "findByKey",
    "save",
    "saveWithOutbox",
    "pendingOutbox",
    "completeOutbox",
    "retryOutbox",
    "claimEvent",
    "applyCallback",
    "clear",
    "close",
  ].map((method) => [method, (...args) => selected()[method](...args)]),
);
