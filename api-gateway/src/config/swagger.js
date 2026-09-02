export const openapi = {
  openapi: "3.0.3",
  info: {
    title: "E-commerce API Gateway",
    version: "1.0.0",
    description:
      "Single entry point for the user, product, order, payment and notification services. Detailed schemas remain in each owning service.",
  },
  servers: [{ url: "/" }],
  paths: {
    "/health": {
      get: {
        summary: "Gateway liveness",
        responses: { 200: { description: "Gateway is running" } },
      },
    },
    "/ready": {
      get: {
        summary: "Check all upstream services",
        responses: {
          200: { description: "All upstreams are reachable" },
          503: { description: "At least one upstream is unavailable" },
        },
      },
    },
    "/api/v1/{resource}/{path}": {
      parameters: [
        {
          name: "resource",
          in: "path",
          required: true,
          schema: {
            type: "string",
            enum: [
              "auth",
              "users",
              "products",
              "inventory",
              "orders",
              "payments",
              "notifications",
            ],
          },
        },
        {
          name: "path",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
      ],
      get: {
        summary: "Proxy a GET request",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Upstream response" } },
      },
      post: {
        summary: "Proxy a POST request",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Upstream response" } },
      },
      put: {
        summary: "Proxy a PUT request",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Upstream response" } },
      },
      patch: {
        summary: "Proxy a PATCH request",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Upstream response" } },
      },
      delete: {
        summary: "Proxy a DELETE request",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Upstream response" } },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
};
