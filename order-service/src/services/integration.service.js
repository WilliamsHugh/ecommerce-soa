const productUrl = process.env.PRODUCT_SERVICE_URL || "http://127.0.0.1:3002";
const paymentUrl = process.env.PAYMENT_SERVICE_URL || "http://127.0.0.1:3004";
const notificationUrl = process.env.NOTIFICATION_SERVICE_URL || "http://127.0.0.1:3005";

export async function getProducts(items) {
  return Promise.all(
    items.map(async (item) => {
      const response = await fetch(`${productUrl}/api/v1/products/${item.product_id}`);
      if (!response.ok) throw new Error(`Product ${item.product_id} not found`);
      return { ...item, product: (await response.json()).data };
    }),
  );
}
export async function reserveStock(items, token) {
  return fetch(`${productUrl}/api/v1/inventory/reserve`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: token },
    body: JSON.stringify({ items }),
  });
}
export function releaseStock(reservationId, token) {
  return fetch(`${productUrl}/api/v1/inventory/reservations/${reservationId}/release`, {
    method: "POST",
    headers: { authorization: token },
  }).catch(() => {});
}
export function initializePayment(order) {
  return fetch(`${paymentUrl}/api/v1/payments`, {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": order.id },
    body: JSON.stringify({ order_id: order.id, amount: order.total, currency: order.currency }),
  }).catch(() => {});
}
export function emitEvent(type, data) {
  return fetch(`${notificationUrl}/api/v1/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type, data, occurred_at: new Date().toISOString() }),
  }).catch(() => {});
}
