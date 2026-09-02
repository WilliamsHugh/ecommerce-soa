import { randomUUID } from "node:crypto";
import { paymentStore } from "../stores/payment.store.js";
import {
  initializeGatewayPayment,
  refundGatewayPayment,
} from "./gateway.service.js";
const transitions = {
  PENDING: ["AUTHORIZED", "CAPTURED", "FAILED", "CANCELLED"],
  AUTHORIZED: ["CAPTURED", "FAILED", "CANCELLED"],
  CAPTURED: ["REFUNDED"],
  FAILED: [],
  REFUNDED: [],
  CANCELLED: [],
};
const fail = (message, status) => Object.assign(new Error(message), { status });
export const canAccess = (auth, payment) =>
  auth.roles.includes("ADMIN") || auth.sub === payment.user_id;
export async function createPayment(input, key, userId) {
  if (!key) throw fail("Idempotency-Key header is required", 400);
  const existing = await paymentStore.findByKey(key, userId, input.order_id);
  if (existing) {
    if (
      existing.amount !== input.amount ||
      existing.currency !== input.currency
    )
      throw fail("Idempotency key was used with a different request", 409);
    return { payment: existing, existed: true };
  }
  const now = new Date().toISOString();
  const gatewayPayment = await initializeGatewayPayment(input, key);
  const payment = {
    id: randomUUID(),
    user_id: userId,
    order_id: input.order_id,
    amount: input.amount,
    currency: input.currency,
    status: gatewayPayment.status,
    gateway: gatewayPayment.gateway,
    gateway_reference: gatewayPayment.gateway_reference,
    idempotency_key: key,
    created_at: now,
    updated_at: now,
    history: [{ status: gatewayPayment.status, at: now }],
  };
  try {
    await paymentStore.save(payment);
  } catch (error) {
    if (error?.code === "23505") {
      const raced = await paymentStore.findByKey(key, userId, input.order_id);
      if (raced) return { payment: raced, existed: true };
    }
    throw error;
  }
  return { payment, existed: false };
}
export async function transitionPayment(payment, target) {
  if (payment.status === target) return payment;
  if (!transitions[payment.status]?.includes(target))
    throw fail(`Invalid transition ${payment.status} -> ${target}`, 409);
  payment.status = target;
  payment.updated_at = new Date().toISOString();
  payment.history.push({ status: target, at: payment.updated_at });
  if (target === "CAPTURED")
    await paymentStore.saveWithOutbox(payment, {
      id: `payment-success:${payment.id}`,
      type: "payment-success",
      payload: { payment_id: payment.id, order_id: payment.order_id },
    });
  else await paymentStore.save(payment);
  return payment;
}
export async function refundPayment(payment, amount) {
  if (payment.status !== "CAPTURED")
    throw fail("Only captured payments can be refunded", 409);
  if (amount && amount > payment.amount)
    throw fail("Refund amount exceeds payment amount", 400);
  payment.refund_amount = amount || payment.amount;
  await refundGatewayPayment(payment, payment.refund_amount);
  return transitionPayment(payment, "REFUNDED");
}
export async function applyCallback(payment, eventId, status) {
  if (
    payment.status !== status &&
    !transitions[payment.status]?.includes(status)
  )
    throw fail(`Invalid transition ${payment.status} -> ${status}`, 409);
  if (payment.status === status) return { payment, duplicate: true };
  const updated = structuredClone(payment);
  updated.status = status;
  updated.updated_at = new Date().toISOString();
  updated.history.push({ status, at: updated.updated_at });
  const message =
    status === "CAPTURED"
      ? {
          id: `payment-success:${payment.id}`,
          type: "payment-success",
          payload: { payment_id: payment.id, order_id: payment.order_id },
        }
      : undefined;
  const claimed = await paymentStore.applyCallback(updated, eventId, message);
  return { payment: claimed ? updated : payment, duplicate: !claimed };
}
