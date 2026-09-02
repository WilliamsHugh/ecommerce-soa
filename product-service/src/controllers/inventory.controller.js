import { randomUUID } from "node:crypto";
import { reservationStore } from "../stores/product.store.js";

export async function reserveInventory(req, res) {
  const reservation = await reservationStore.reserve({
    id: randomUUID(),
    user_id: req.auth.sub,
    items: req.validated.body.items,
    status: "RESERVED",
    created_at: new Date().toISOString(),
  });
  if (!reservation)
    return res.status(409).json({ error: "Insufficient stock or product unavailable" });
  res.status(201).json({ data: reservation });
}

export async function releaseInventory(req, res) {
  const reservation = await reservationStore.find(req.validated.params.id);
  if (!reservation || reservation.status !== "RESERVED")
    return res.status(404).json({ error: "Active reservation not found" });
  if (reservation.user_id !== req.auth.sub && !req.auth.roles.includes("ADMIN"))
    return res.status(403).json({ error: "Not reservation owner" });
  const released = await reservationStore.release(reservation.id);
  return released
    ? res.json({ data: released })
    : res.status(404).json({ error: "Active reservation not found" });
}
