import { env } from "../config/env.js";
import { paymentStore } from "../stores/payment.store.js";
import { notifyOrderPaymentSuccess } from "./order-client.service.js";

let processing = false;
export async function processOutbox() {
  if (processing) return;
  processing = true;
  try {
    for (const message of await paymentStore.pendingOutbox()) {
      try {
        if (message.type === "payment-success")
          await notifyOrderPaymentSuccess({
            id: message.payload.payment_id,
            order_id: message.payload.order_id,
          });
        await paymentStore.completeOutbox(message.id);
      } catch (error) {
        await paymentStore.retryOutbox(message.id, error.message);
      }
    }
  } finally {
    processing = false;
  }
}

export function startOutboxWorker() {
  const timer = setInterval(() => void processOutbox(), env.outboxPollMs);
  timer.unref();
  void processOutbox();
  return () => clearInterval(timer);
}
