export const openapi = {
  openapi: "3.0.3",
  info: {
    title: "Order Service API",
    version: "1.0.0",
    description: "Order creation and state-machine workflow.",
  },
  servers: [
    { url: "http://localhost:3003" },
    { url: "http://localhost:3000", description: "API Gateway" },
  ],
  security: [{ bearerAuth: [] }],
  paths: {
    "/api/v1/orders": {
      post: {
        summary: "Create order and reserve inventory",
        tags: ["Orders"],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/OrderInput" } } },
        },
        responses: {
          201: { description: "Order created" },
          409: { description: "Inventory unavailable" },
          502: { description: "Dependent service unavailable" },
        },
      },
      get: {
        summary: "List orders of a user",
        tags: ["Orders"],
        parameters: [{ name: "userId", in: "query", schema: { type: "string" } }],
        responses: { 200: { description: "Orders" } },
      },
    },
    "/api/v1/orders/{id}": {
      get: {
        summary: "Get order detail",
        tags: ["Orders"],
        parameters: [{ $ref: "#/components/parameters/Id" }],
        responses: {
          200: {
            description: "Order",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { data: { $ref: "#/components/schemas/Order" } },
                },
              },
            },
          },
          404: { description: "Order not found" },
        },
      },
    },
    "/api/v1/orders/{id}/confirm": {
      post: {
        summary: "Confirm order",
        tags: ["Workflow"],
        parameters: [{ $ref: "#/components/parameters/Id" }],
        responses: {
          200: { description: "Confirmed" },
          409: { description: "Invalid transition" },
        },
      },
    },
    "/api/v1/orders/{id}/cancel": {
      post: {
        summary: "Cancel order before shipment",
        tags: ["Workflow"],
        parameters: [{ $ref: "#/components/parameters/Id" }],
        responses: {
          200: { description: "Cancelled" },
          409: { description: "Invalid transition" },
        },
      },
    },
    "/api/v1/orders/{id}/status": {
      patch: {
        summary: "Move order to the next valid state",
        tags: ["Workflow"],
        parameters: [{ $ref: "#/components/parameters/Id" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status"],
                properties: { status: { $ref: "#/components/schemas/OrderStatus" } },
              },
            },
          },
        },
        responses: {
          200: { description: "Status updated" },
          409: { description: "Invalid transition" },
        },
      },
    },
    "/api/v1/internal/orders/{id}/payment-success": {
      post: {
        summary: "Internal payment callback",
        tags: ["Internal"],
        security: [],
        parameters: [{ $ref: "#/components/parameters/Id" }],
        requestBody: {
          content: {
            "application/json": {
              schema: { type: "object", properties: { payment_id: { type: "string" } } },
            },
          },
        },
        responses: { 200: { description: "Payment applied" } },
      },
    },
  },
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    parameters: { Id: { name: "id", in: "path", required: true, schema: { type: "string" } } },
    schemas: {
      OrderStatus: {
        type: "string",
        enum: ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"],
      },
      OrderItemInput: {
        type: "object",
        required: ["product_id", "quantity"],
        properties: { product_id: { type: "string" }, quantity: { type: "integer", minimum: 1 } },
      },
      OrderInput: {
        type: "object",
        required: ["items", "shipping_address"],
        properties: {
          items: {
            type: "array",
            minItems: 1,
            items: { $ref: "#/components/schemas/OrderItemInput" },
          },
          shipping_address: { type: "string" },
        },
      },
      Order: {
        type: "object",
        properties: {
          id: { type: "string" },
          user_id: { type: "string" },
          items: { type: "array", items: { type: "object" } },
          total: { type: "number" },
          currency: { type: "string" },
          status: { $ref: "#/components/schemas/OrderStatus" },
          reservation_id: { type: "string" },
          created_at: { type: "string", format: "date-time" },
        },
      },
    },
  },
};
