import { orderStore } from "../stores/order.store.js";
import { applyPayment, canAccess, changeStatus, createOrder } from "../services/order.service.js";

export async function create(req, res) {
  const items = req.body.items;
  if (
    !Array.isArray(items) ||
    !items.length ||
    items.some((item) => !item.product_id || !(item.quantity > 0))
  )
    return res.status(400).json({ error: "A non-empty valid items array is required" });
  try {
    const order = await createOrder({
      items,
      shippingAddress: req.body.shipping_address,
      auth: req.auth,
      token: req.token,
    });
    res.status(201).json({ data: order });
  } catch (error) {
    res.status(error.status || 502).json({ error: error.message, details: error.details });
  }
}
export function list(req, res) {
  const userId = req.query.userId || req.auth.sub;
  if (userId !== req.auth.sub && !req.auth.roles.includes("ADMIN"))
    return res.status(403).json({ error: "Insufficient permissions" });
  res.json({ data: orderStore.all().filter((order) => order.user_id === userId) });
}
export function get(req, res) {
  const order = orderStore.find(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  return canAccess(req.auth, order)
    ? res.json({ data: order })
    : res.status(403).json({ error: "Insufficient permissions" });
}
export function updateStatus(req, res, forcedStatus) {
  const order = orderStore.find(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (!canAccess(req.auth, order))
    return res.status(403).json({ error: "Insufficient permissions" });
  try {
    res.json({
      data: changeStatus(
        order,
        forcedStatus || String(req.body.status || "").toUpperCase(),
        req.token,
      ),
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
}
export function paymentSuccess(req, res) {
  const order = orderStore.find(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json({ data: applyPayment(order, req.body.payment_id) });
}
