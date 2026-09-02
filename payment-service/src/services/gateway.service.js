import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";

async function callGateway(path, payload, fetchImpl = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.dependencyTimeoutMs);
  try {
    const response = await fetchImpl(new URL(path, env.gatewayApiUrl), {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.gatewayApiKey}`,
        "content-type": "application/json",
        "idempotency-key": payload.idempotency_key,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok)
      throw Object.assign(
        new Error(`Payment gateway returned ${response.status}`),
        {
          status: response.status >= 500 ? 502 : 400,
        },
      );
    return response.json();
  } catch (error) {
    if (error.status) throw error;
    throw Object.assign(new Error("Payment gateway is unavailable"), {
      status: 502,
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function initializeGatewayPayment(input, key, fetchImpl) {
  if (env.gatewayProvider === "soap_sandbox")
    return {
      gateway: "SOAP_SANDBOX",
      gateway_reference: `GW-${randomUUID()}`,
      status: "PENDING",
    };
  const result = await callGateway(
    "/payments",
    {
      order_id: input.order_id,
      amount: input.amount,
      currency: input.currency,
      idempotency_key: key,
    },
    fetchImpl,
  );
  if (
    !result.reference ||
    !["PENDING", "AUTHORIZED"].includes(result.status || "PENDING")
  )
    throw Object.assign(new Error("Invalid payment gateway response"), {
      status: 502,
    });
  return {
    gateway: "HTTP_PROVIDER",
    gateway_reference: result.reference,
    status: result.status || "PENDING",
  };
}

export async function refundGatewayPayment(payment, amount, fetchImpl) {
  if (env.gatewayProvider === "soap_sandbox") return;
  await callGateway(
    `/payments/${encodeURIComponent(payment.gateway_reference)}/refunds`,
    {
      amount,
      idempotency_key: `refund-${payment.id}-${amount}`,
    },
    fetchImpl,
  );
}
