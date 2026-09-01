import { orderStore } from "../stores/order.store.js";
import { applyPayment, canAccess, changeStatus, createOrder } from "../services/order.service.js";

export async function create(req, res) {
  const items = req.body.items;
  if (
    !Array.isArray(items) ||
    !items.length ||
    items.some(
      (item) => !item.product_id || !Number.isInteger(item.quantity) || !(item.quantity > 0),
    ) ||
    typeof req.body.shipping_address !== "string" ||
    req.body.shipping_address.trim().length < 5
  )
    return res.status(400).json({ error: "items and a valid shipping_address are required" });
  try {
    const order = await createOrder({
      items,
      shippingAddress: req.body.shipping_address,
      auth: req.auth,
      token: req.token,
      idempotencyKey: req.headers["idempotency-key"],
    });
    res.status(201).json({ data: order });
  } catch (error) {
    res.status(error.status || 502).json({ error: error.message, details: error.details });
  }
}
export async function list(req, res) {
  const userId = req.query.userId || req.auth.sub;
  if (userId !== req.auth.sub && !req.auth.roles.includes("ADMIN"))
    return res.status(403).json({ error: "Insufficient permissions" });
  res.json({ data: await orderStore.all(userId) });
}
export async function get(req, res) {
  const order = await orderStore.find(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  return canAccess(req.auth, order)
    ? res.json({ data: order })
    : res.status(403).json({ error: "Insufficient permissions" });
}
export async function updateStatus(req, res, forcedStatus) {
  const order = await orderStore.find(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (!canAccess(req.auth, order))
    return res.status(403).json({ error: "Insufficient permissions" });
  try {
    res.json({
      data: await changeStatus(
        order,
        forcedStatus || String(req.body.status || "").toUpperCase(),
        req.token,
      ),
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
}
export async function paymentSuccess(req, res) {
  const order = await orderStore.find(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json({ data: applyPayment(order, req.body.payment_id) });
}
