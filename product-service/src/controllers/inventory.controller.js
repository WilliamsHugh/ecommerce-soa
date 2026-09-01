import { randomUUID } from "node:crypto";
import { productStore, reservationStore } from "../stores/product.store.js";

export async function reserveInventory(req, res) {
  const items = req.validated.body.items;
  const reservedItems = await productStore.reserve(items);
  if (!reservedItems)
    return res.status(409).json({ error: "Insufficient stock or product unavailable" });
  const reservation = reservationStore.save({
    id: randomUUID(),
    user_id: req.auth.sub,
    items: reservedItems,
    status: "RESERVED",
    created_at: new Date().toISOString(),
  });
  res.status(201).json({ data: reservation });
}

export async function releaseInventory(req, res) {
  const reservation = reservationStore.find(req.validated.params.id);
  if (!reservation || reservation.status !== "RESERVED")
    return res.status(404).json({ error: "Active reservation not found" });
  if (reservation.user_id !== req.auth.sub && !req.auth.roles.includes("ADMIN"))
    return res.status(403).json({ error: "Not reservation owner" });
  await productStore.release(reservation.items);
  reservation.status = "RELEASED";
  reservation.released_at = new Date().toISOString();
  res.json({ data: reservation });
}
