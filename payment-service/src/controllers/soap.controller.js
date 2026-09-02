import { createPayment } from "../services/payment.service.js";
import { createPaymentSchema } from "../validation/payment.validation.js";

export const wsdl = (_req, res) =>
  res
    .type("application/xml")
    .send(
      `<?xml version="1.0"?><definitions xmlns="http://schemas.xmlsoap.org/wsdl/" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" xmlns:tns="urn:ecommerce:payment" targetNamespace="urn:ecommerce:payment"><message name="ProcessPaymentRequest"/><message name="ProcessPaymentResponse"/><portType name="PaymentPortType"><operation name="processPayment"><input message="tns:ProcessPaymentRequest"/><output message="tns:ProcessPaymentResponse"/></operation></portType><binding name="PaymentBinding" type="tns:PaymentPortType"><soap:binding transport="http://schemas.xmlsoap.org/soap/http"/></binding></definitions>`,
    );
const escapeXml = (value) =>
  String(value).replace(
    /[<>&'"]/g,
    (char) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        "'": "&apos;",
        '"': "&quot;",
      })[char],
  );
export async function gateway(req, res) {
  const get = (tag) =>
    (req.body || "").match(new RegExp(`<[^>]*${tag}[^>]*>([^<]+)`))?.[1];
  try {
    const input = createPaymentSchema.parse({
      order_id: get("orderId"),
      amount: +get("amount"),
      currency: get("currency") || "VND",
    });
    const { payment } = await createPayment(
      input,
      req.header("idempotency-key"),
      req.header("x-user-id") || "internal-soap",
    );
    res
      .type("application/soap+xml")
      .send(
        `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><processPaymentResponse xmlns="urn:ecommerce:payment"><paymentId>${payment.id}</paymentId><gatewayReference>${payment.gateway_reference}</gatewayReference><status>${payment.status}</status></processPaymentResponse></soap:Body></soap:Envelope>`,
      );
  } catch (error) {
    res
      .status(400)
      .type("application/soap+xml")
      .send(
        `<soap:Fault xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><faultcode>Client</faultcode><faultstring>${escapeXml(error.message)}</faultstring></soap:Fault>`,
      );
  }
}
