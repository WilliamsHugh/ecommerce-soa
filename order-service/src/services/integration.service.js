import { env } from "../config/env.js";

const productUrl = env.productServiceUrl;
const paymentUrl = env.paymentServiceUrl;
const notificationUrl = env.notificationServiceUrl;

const fetchWithTimeout = (url, options = {}) =>
  fetch(url, { ...options, signal: AbortSignal.timeout(env.dependencyTimeoutMs) });

export async function getProducts(items) {
  return Promise.all(
    items.map(async (item) => {
      const response = await fetchWithTimeout(`${productUrl}/api/v1/products/${item.product_id}`);
      if (!response.ok) throw new Error(`Product ${item.product_id} not found`);
      return { ...item, product: (await response.json()).data };
    }),
  );
}
export async function reserveStock(items, token) {
  return fetchWithTimeout(`${productUrl}/api/v1/inventory/reserve`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: token },
    body: JSON.stringify({ items }),
  });
}
export function releaseStock(reservationId, token) {
  return fetchWithTimeout(`${productUrl}/api/v1/inventory/reservations/${reservationId}/release`, {
    method: "POST",
    headers: { authorization: token },
  }).catch(() => {});
}
export function initializePayment(order) {
  return fetchWithTimeout(`${paymentUrl}/api/v1/payments`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": order.id },
    body: JSON.stringify({ order_id: order.id, amount: order.total, currency: order.currency }),
  }).catch(() => {});
}
export function emitEvent(type, data) {
  return fetchWithTimeout(`${notificationUrl}/api/v1/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type, data, occurred_at: new Date().toISOString() }),
  }).catch(() => {});
}
