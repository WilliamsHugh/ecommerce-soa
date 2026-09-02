import { processEvent } from "../services/notification.service.js";
import { notificationStore } from "../stores/notification.store.js";

export async function receiveEvent(req, res) {
  const notification = await processEvent(req.body);
  if (notification?.duplicate) return res.status(202).json({ duplicate: true });
  if (!notification)
    return res.status(202).json({ ignored: true, reason: "Unsupported event" });
  res.status(202).json({ data: notification });
}
export async function listNotifications(req, res) {
  const recipient = req.query.recipient || req.auth.sub;
  if (recipient !== req.auth.sub && !req.auth.roles?.includes("ADMIN"))
    return res.status(403).json({ error: "Insufficient permissions" });
  res.json({ data: await notificationStore.findByRecipient(recipient) });
}
export async function markRead(req, res) {
  const result = await notificationStore.markRead(req.params.id, req.auth.sub);
  if (!result) return res.status(404).json({ error: "Notification not found" });
  return res.json({ data: result });
}
