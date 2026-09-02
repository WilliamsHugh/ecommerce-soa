import {
  applyCallback,
  canAccess,
  createPayment,
  refundPayment,
} from "../services/payment.service.js";
import { paymentStore } from "../stores/payment.store.js";
export async function create(req, res, next) {
  try {
    const { payment, existed } = await createPayment(
      req.body,
      req.header("idempotency-key"),
      req.auth.sub,
    );
    res.status(existed ? 200 : 201).json({
      data: payment,
      payment_url: `/soap/gateway?payment_id=${payment.id}`,
    });
  } catch (e) {
    next(e);
  }
}
export async function get(req, res, next) {
  try {
    const payment = await paymentStore.find(req.params.id);
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    if (!canAccess(req.auth, payment))
      return res.status(403).json({ error: "Payment access denied" });
    res.json({ data: payment });
  } catch (e) {
    next(e);
  }
}
export async function byOrder(req, res, next) {
  try {
    const userId = req.auth.roles.includes("ADMIN") ? undefined : req.auth.sub;
    res.json({
      data: await paymentStore.findByOrder(req.params.order_id, userId),
    });
  } catch (e) {
    next(e);
  }
}
export async function refund(req, res, next) {
  try {
    const payment = await paymentStore.find(req.params.id);
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    if (!canAccess(req.auth, payment))
      return res.status(403).json({ error: "Payment access denied" });
    res.json({ data: await refundPayment(payment, req.body.amount) });
  } catch (e) {
    next(e);
  }
}
export async function callback(req, res, next) {
  try {
    const payment = req.body.gateway_reference
      ? await paymentStore.findByGatewayReference(req.body.gateway_reference)
      : await paymentStore.find(req.body.payment_id);
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    const result = await applyCallback(
      payment,
      req.body.event_id,
      req.body.status,
    );
    res.json({ data: result.payment, duplicate: result.duplicate });
  } catch (e) {
    next(e);
  }
}
