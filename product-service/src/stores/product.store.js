import { env } from "../config/env.js";
import { elasticsearchStore } from "./elasticsearch.store.js";

const products = new Map();
const reservations = new Map();
let inventoryQueue = Promise.resolve();
const persistent = env.productStoreDriver === "elasticsearch" ? elasticsearchStore : null;
const lock = (operation) => {
  const next = inventoryQueue.then(operation, operation);
  inventoryQueue = next.catch(() => {});
  return next;
};

export const productStore = {
  all: async () => (persistent ? persistent.all() : [...products.values()]),
  find: async (id) => (persistent ? persistent.find(id) : products.get(id)),
  async save(product) {
    if (persistent) return persistent.save(product);
    products.set(product.id, product);
    return product;
  },
  async update(product) {
    if (persistent) return persistent.update(product);
    products.set(product.id, product);
    return product;
  },
  async remove(id) {
    if (persistent) return persistent.remove(id);
    const product = products.get(id);
    if (!product) return false;
    product.deleted_at = new Date().toISOString();
    return true;
  },
  async reserve(items) {
    return lock(async () => {
      const current = await this.all();
      const requested = new Map();
      for (const item of items)
        requested.set(item.product_id, (requested.get(item.product_id) || 0) + item.quantity);
      const normalized = [...requested.entries()].map(([product_id, quantity]) => ({
        product_id,
        quantity,
      }));
      const checked = normalized.map((item) => ({
        item,
        product: current.find((product) => product.id === item.product_id),
      }));
      if (
        checked.some(
          ({ item, product }) =>
            !product ||
            product.deleted_at ||
            product.stock - product.reserved_stock < item.quantity,
        )
      )
        return null;
      for (const { item, product } of checked) {
        product.reserved_stock += item.quantity;
        product.updated_at = new Date().toISOString();
        await this.update(product);
      }
      return checked.map(({ item }) => item);
    });
  },
  async release(items) {
    return lock(async () => {
      for (const item of items) {
        const product = await this.find(item.product_id);
        if (product) {
          product.reserved_stock = Math.max(0, product.reserved_stock - item.quantity);
          await this.update(product);
        }
      }
    });
  },
};

export const reservationStore = {
  find: (id) => reservations.get(id),
  save(reservation) {
    reservations.set(reservation.id, reservation);
    return reservation;
  },
};

export function clearStore() {
  products.clear();
  reservations.clear();
}
