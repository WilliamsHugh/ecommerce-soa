import { randomUUID } from "node:crypto";
import { notificationStore } from "../stores/notification.store.js";
import { env } from "../config/env.js";

const templates = {
  OrderCreated: ["EMAIL", "Đơn hàng đã được tạo"],
  PaymentSuccess: ["EMAIL", "Thanh toán thành công"],
  OrderConfirmed: ["EMAIL", "Đơn hàng đã xác nhận"],
  OrderShipped: ["PUSH", "Đơn hàng đang được giao"],
  OrderDelivered: ["EMAIL", "Đơn hàng đã giao, vui lòng đánh giá"],
  LowStock: ["EMAIL", "Sản phẩm sắp hết hàng"],
};

const fetchDelivery = async (notification) => {
  if (!env.deliveryProviderUrl) return true;
  for (let attempt = 0; attempt <= env.dependencyRetries; attempt += 1) {
    try {
      const response = await fetch(env.deliveryProviderUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(notification),
        signal: AbortSignal.timeout(env.dependencyTimeoutMs),
      });
      if (response.ok) return true;
      if (response.status < 500) return false;
    } catch {
      if (attempt === env.dependencyRetries) return false;
    }
    await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
  }
  return false;
};

export async function processEvent(event) {
  const template = templates[event.type];
  if (!template) return null;
  const recipient =
    event.data?.email || event.data?.user_id || event.data?.seller?.id;
  if (!recipient) return null;
  const notification = {
    id: randomUUID(),
    event_id: event.event_id,
    event_type: event.type,
    recipient,
    channel: template[0],
    message: template[1],
    status: "PENDING",
    payload: event.data,
    created_at: new Date().toISOString(),
  };
  const accepted = await notificationStore.add(notification);
  if (!accepted) return { duplicate: true };
  const delivered = await fetchDelivery(notification);
  accepted.status = delivered ? "SENT" : "FAILED";
  if (delivered) accepted.sent_at = new Date().toISOString();
  await notificationStore.updateStatus(accepted.id, accepted.status);
  console.log(JSON.stringify({ event: "NotificationSent", ...notification }));
  return accepted;
}
