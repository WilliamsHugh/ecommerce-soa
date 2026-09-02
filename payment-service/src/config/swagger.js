const jsonBody = (schema) => ({
  required: true,
  content: { "application/json": { schema } },
});
const idParameter = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string" },
};

export const openapi = {
  openapi: "3.0.3",
  info: {
    title: "Payment Service API",
    version: "1.0.0",
    description:
      "REST payment facade. SOAP contract is available at /soap/payment.wsdl.",
  },
  servers: [
    { url: "http://localhost:3004" },
    { url: "http://localhost:3000", description: "API Gateway" },
  ],
  security: [{ bearerAuth: [] }],
  paths: {
    "/api/v1/payments": {
      post: {
        summary: "Initialize payment",
        tags: ["Payments"],
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: jsonBody({ $ref: "#/components/schemas/PaymentInput" }),
        responses: {
          201: { description: "Payment initialized" },
          200: { description: "Existing idempotent payment" },
          400: { description: "Validation or missing idempotency key" },
          401: { description: "Invalid bearer token" },
          409: { description: "Idempotency key conflict" },
        },
      },
    },
    "/api/v1/payments/order/{order_id}": {
      get: {
        summary: "Query payments by order; scoped to the caller unless ADMIN",
        tags: ["Payments"],
        parameters: [
          {
            name: "order_id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "Payments" },
          401: { description: "Invalid bearer token" },
        },
      },
    },
    "/api/v1/payments/{id}": {
      get: {
        summary: "Get payment status",
        tags: ["Payments"],
        parameters: [idParameter],
        responses: {
          200: { description: "Payment" },
          404: { description: "Payment not found" },
        },
      },
    },
    "/api/v1/payments/{id}/refund": {
      post: {
        summary: "Refund successful payment",
        tags: ["Payments"],
        parameters: [idParameter],
        requestBody: jsonBody({
          type: "object",
          properties: { amount: { type: "number", minimum: 1 } },
        }),
        responses: {
          200: { description: "Refunded" },
          409: { description: "Payment cannot be refunded" },
        },
      },
    },
    "/api/v1/payments/callback": {
      post: {
        summary: "Payment gateway callback",
        tags: ["Callbacks"],
        security: [{ internalSecret: [] }],
        requestBody: jsonBody({
          type: "object",
          properties: {
            event_id: { type: "string" },
            payment_id: { type: "string", format: "uuid" },
            gateway_reference: { type: "string" },
            status: {
              type: "string",
              enum: ["AUTHORIZED", "CAPTURED", "FAILED", "CANCELLED"],
            },
          },
        }),
        responses: { 200: { description: "Callback processed" } },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      internalSecret: {
        type: "apiKey",
        in: "header",
        name: "X-Internal-Service-Secret",
      },
    },
    schemas: {
      PaymentInput: {
        type: "object",
        required: ["order_id", "amount"],
        properties: {
          order_id: { type: "string" },
          amount: { type: "number", minimum: 1 },
          currency: { type: "string", default: "VND" },
        },
      },
    },
  },
};
