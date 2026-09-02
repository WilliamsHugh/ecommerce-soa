export const openapi = {
  openapi: "3.0.3",
  info: {
    title: "Notification Service API",
    version: "1.0.0",
    description: "Event consumer and notification delivery adapter.",
  },
  servers: [
    { url: "http://localhost:3005" },
    { url: "http://localhost:3000", description: "API Gateway" },
  ],
  security: [{ bearerAuth: [] }],
  paths: {
    "/api/v1/events": {
      post: {
        summary: "Consume a domain event",
        security: [],
        tags: ["Events"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Event" },
            },
          },
        },
        responses: { 202: { description: "Event accepted or ignored" } },
      },
    },
    "/api/v1/notifications": {
      get: {
        summary: "List delivered notifications",
        tags: ["Notifications"],
        parameters: [
          { name: "recipient", in: "query", schema: { type: "string" } },
        ],
        responses: {
          200: {
            description: "Notifications",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Notification" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/notifications/{id}/read": {
      post: {
        summary: "Mark notification as read",
        tags: ["Notifications"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          200: { description: "Notification marked as read" },
          404: { description: "Not found" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      Event: {
        type: "object",
        required: ["type", "data"],
        properties: {
          type: {
            type: "string",
            enum: [
              "OrderCreated",
              "PaymentSuccess",
              "OrderConfirmed",
              "OrderShipped",
              "OrderDelivered",
              "LowStock",
            ],
          },
          data: { type: "object", additionalProperties: true },
          occurred_at: { type: "string", format: "date-time" },
        },
      },
      Notification: {
        type: "object",
        properties: {
          id: { type: "string" },
          event_type: { type: "string" },
          recipient: { type: "string" },
          channel: { type: "string", enum: ["EMAIL", "SMS", "PUSH"] },
          message: { type: "string" },
          status: { type: "string" },
          created_at: { type: "string", format: "date-time" },
        },
      },
    },
  },
};
