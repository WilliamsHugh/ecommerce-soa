import { env } from "../config/env.js";

const productUrl = env.productServiceUrl;
const paymentUrl = env.paymentServiceUrl;
const notificationUrl = env.notificationServiceUrl;

const fetchWithRetry = async (url, options = {}) => {
  let lastError;
  for (let attempt = 0; attempt <= env.dependencyRetries; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(env.dependencyTimeoutMs),
      });
      if (response.status < 500 || attempt === env.dependencyRetries) return response;
    } catch (error) {
      lastError = error;
      if (attempt === env.dependencyRetries) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
  }
  throw lastError || new Error("Dependency request failed");
};

export async function getProducts(items) {
  return Promise.all(
    items.map(async (item) => {
      const response = await fetchWithRetry(`${productUrl}/api/v1/products/${item.product_id}`);
      if (!response.ok) throw new Error(`Product ${item.product_id} not found`);
      return { ...item, product: (await response.json()).data };
    }),
  );
}
export async function reserveStock(items, token) {
  return fetchWithRetry(`${productUrl}/api/v1/inventory/reserve`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: token },
    body: JSON.stringify({ items }),
  });
}
export function releaseStock(reservationId, token) {
  return fetchWithRetry(`${productUrl}/api/v1/inventory/reservations/${reservationId}/release`, {
    method: "POST",
    headers: { authorization: token },
  }).catch(() => {});
}
export function initializePayment(order) {
  return fetchWithRetry(`${paymentUrl}/api/v1/payments`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": order.id },
    body: JSON.stringify({ order_id: order.id, amount: order.total, currency: order.currency }),
  }).catch(() => {});
}
export function emitEvent(type, data) {
  return fetchWithRetry(`${notificationUrl}/api/v1/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type, data, occurred_at: new Date().toISOString() }),
  }).catch(() => {});
}
