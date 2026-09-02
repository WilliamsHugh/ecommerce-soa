import { env } from "../config/env.js";
import { postgresNotificationStore } from "./postgres.store.js";

const notifications = [];
const memoryStore = {
  add(item) {
    const existing =
      item.event_id &&
      notifications.find(
        (n) => n.event_id === item.event_id && n.recipient === item.recipient,
      );
    if (existing) return null;
    notifications.push(item);
    return item;
  },
  findByRecipient(recipient) {
    return notifications.filter(
      (item) => !recipient || item.recipient === recipient,
    );
  },
  markRead(id, recipient) {
    const item = notifications.find(
      (n) => n.id === id && n.recipient === recipient,
    );
    if (!item) return null;
    item.status = "READ";
    item.read_at = new Date().toISOString();
    return item;
  },
  check: () => true,
};
const store =
  env.storeDriver === "postgres" ? postgresNotificationStore : memoryStore;

export const notificationStore = {
  add: (notification) => store.add(notification),
  findByRecipient: (recipient) => store.findByRecipient(recipient),
  markRead: (id, recipient) => store.markRead(id, recipient),
  updateStatus: (id, status) => store.updateStatus?.(id, status),
  check: () => store.check(),
};
