import { randomUUID } from "node:crypto";
import { orderStore } from "../stores/order.store.js";
import {
  emitEvent,
  getProducts,
  initializePayment,
  releaseStock,
  reserveStock,
} from "./integration.service.js";

const transitions = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};
export const canAccess = (auth, order) =>
  order.user_id === auth.sub || auth.roles.includes("ADMIN");

export async function createOrder({ items, shippingAddress, auth, token }) {
  const details = await getProducts(items);
  const response = await reserveStock(items, token);
  if (!response.ok)
    throw Object.assign(new Error("Unable to reserve inventory"), {
      status: 409,
      details: await response.json(),
    });
  const reservation = (await response.json()).data;
  const now = new Date().toISOString();
  const order = orderStore.save({
    id: randomUUID(),
    user_id: auth.sub,
    items: details.map(({ product, quantity }) => ({
      product_id: product.id,
      name: product.name,
      quantity,
      unit_price: product.price,
      subtotal: product.price * quantity,
    })),
    total: details.reduce((sum, { product, quantity }) => sum + product.price * quantity, 0),
    currency: details[0].product.currency,
    status: "PENDING",
    reservation_id: reservation.id,
    shipping_address: shippingAddress,
    created_at: now,
    updated_at: now,
  });
  emitEvent("OrderCreated", order);
  initializePayment(order);
  return order;
}

export function changeStatus(order, target, token) {
  if (!transitions[order.status].includes(target))
    throw Object.assign(new Error(`Invalid transition ${order.status} -> ${target}`), {
      status: 409,
    });
  order.status = target;
  order.updated_at = new Date().toISOString();
  if (target === "CANCELLED") releaseStock(order.reservation_id, token);
  if (["CONFIRMED", "SHIPPED", "DELIVERED"].includes(target))
    emitEvent(`Order${target[0] + target.slice(1).toLowerCase()}`, order);
  return order;
}

export function applyPayment(order, paymentId) {
  if (order.status === "PENDING") {
    order.status = "CONFIRMED";
    order.payment_id = paymentId;
    order.updated_at = new Date().toISOString();
    emitEvent("PaymentSuccess", order);
    emitEvent("OrderConfirmed", order);
  }
  return order;
}
