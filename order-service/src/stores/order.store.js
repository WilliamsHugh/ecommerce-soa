import { env } from "../config/env.js";
import { postgresOrderStore } from "./postgres.store.js";

const orders = new Map();
const memoryStore = {
  all: (userId) => [...orders.values()].filter((order) => !userId || order.user_id === userId),
  byIdempotency: (key, userId) =>
    [...orders.values()].find((order) => order.idempotency_key === key && order.user_id === userId),
  find: (id) => orders.get(id),
  save(order) {
    orders.set(order.id, order);
    return order;
  },
  clear: () => orders.clear(),
};

export const orderStore = {
  check: () => (env.orderStoreDriver === "postgres" ? postgresOrderStore.check() : true),
  all: (...args) =>
    env.orderStoreDriver === "postgres"
      ? postgresOrderStore.all(...args)
      : memoryStore.all(...args),
  find: (...args) =>
    env.orderStoreDriver === "postgres"
      ? postgresOrderStore.find(...args)
      : memoryStore.find(...args),
  byIdempotency: (key, userId) =>
    env.orderStoreDriver === "postgres"
      ? postgresOrderStore.byIdempotency(key, userId)
      : memoryStore.byIdempotency(key, userId),
  save: (...args) =>
    env.orderStoreDriver === "postgres"
      ? postgresOrderStore.save(...args)
      : memoryStore.save(...args),
  clear: () =>
    env.orderStoreDriver === "postgres" ? postgresOrderStore.clear() : memoryStore.clear(),
};
