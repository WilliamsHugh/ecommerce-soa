import { env } from "../config/env.js";
const retryable = (error) =>
  error.name === "AbortError" || !error.status || error.status >= 500;
export async function notifyOrderPaymentSuccess(payment, fetchImpl = fetch) {
  let lastError;
  for (let attempt = 0; attempt <= env.dependencyRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      env.dependencyTimeoutMs,
    );
    try {
      const response = await fetchImpl(
        `${env.orderServiceUrl}/api/v1/internal/orders/${encodeURIComponent(payment.order_id)}/payment-success`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-internal-service-secret": env.internalServiceSecret,
          },
          body: JSON.stringify({ payment_id: payment.id }),
          signal: controller.signal,
        },
      );
      if (response.ok) return;
      throw Object.assign(
        new Error(`Order service returned ${response.status}`),
        { status: response.status },
      );
    } catch (error) {
      lastError = error;
      if (!retryable(error) || attempt === env.dependencyRetries) break;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw Object.assign(new Error("Unable to notify order service"), {
    status: 502,
    cause: lastError,
  });
}
