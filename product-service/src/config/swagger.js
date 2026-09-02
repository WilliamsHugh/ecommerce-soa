export const openapi = {
  openapi: "3.0.3",
  info: {
    title: "Product Service API",
    version: "1.0.0",
    description: "Product catalog, search and inventory reservations.",
  },
  servers: [{ url: "/", description: "Current product-service origin (local or deployed)" }],
  tags: [{ name: "Products" }, { name: "Inventory" }, { name: "Media" }],
  paths: {
    "/api/v1/products": {
      get: {
        tags: ["Products"],
        summary: "List and filter products",
        parameters: ["page", "limit", "sort", "order", "category", "min_price", "max_price"].map(
          (name) => ({
            name,
            in: "query",
            schema: {
              type: ["page", "limit", "min_price", "max_price"].includes(name)
                ? "number"
                : "string",
            },
          }),
        ),
        responses: { 200: { description: "Paginated products" } },
      },
      post: {
        tags: ["Products"],
        summary: "Create product (SELLER/ADMIN)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ProductInput" } },
          },
        },
        responses: {
          201: { description: "Product created" },
          400: { $ref: "#/components/responses/BadRequest" },
        },
      },
    },
    "/api/v1/products/search": {
      get: {
        tags: ["Products"],
        summary: "Full-text product search",
        parameters: [{ name: "q", in: "query", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Search results" } },
      },
    },
    "/api/v1/products/{id}": {
      get: {
        tags: ["Products"],
        summary: "Get product",
        parameters: [{ $ref: "#/components/parameters/Id" }],
        responses: {
          200: {
            description: "Product",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { data: { $ref: "#/components/schemas/Product" } },
                },
              },
            },
          },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        tags: ["Products"],
        summary: "Update product",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/Id" }],
        requestBody: {
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ProductInput" } },
          },
        },
        responses: { 200: { description: "Updated product" } },
      },
      delete: {
        tags: ["Products"],
        summary: "Soft-delete product",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/Id" }],
        responses: { 204: { description: "Deleted" } },
      },
    },
    "/api/v1/inventory/reserve": {
      post: {
        tags: ["Inventory"],
        summary: "Reserve stock",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ReservationInput" } },
          },
        },
        responses: {
          201: { description: "Stock reserved" },
          409: { description: "Insufficient stock" },
        },
      },
    },
    "/api/v1/inventory/reservations/{id}/release": {
      post: {
        tags: ["Inventory"],
        summary: "Release reservation",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/Id" }],
        responses: {
          200: { description: "Reservation released" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/api/v1/products/{id}/images/presign": {
      post: {
        tags: ["Media"],
        summary: "Create an S3/MinIO image upload URL",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/Id" }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ImagePresignInput" } },
          },
        },
        responses: {
          201: { description: "Upload URL created" },
          413: { description: "Image too large" },
          503: { description: "Image storage unavailable" },
        },
      },
    },
  },
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    parameters: {
      Id: { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
    },
    schemas: {
      ProductInput: {
        type: "object",
        required: ["name", "sku", "category", "price", "stock"],
        properties: {
          name: { type: "string" },
          sku: { type: "string" },
          category: { oneOf: [{ type: "string" }, { type: "object" }] },
          price: { type: "number", minimum: 0 },
          currency: { type: "string", default: "VND" },
          stock: { type: "integer", minimum: 0 },
          images: { type: "array", items: { type: "string", format: "uri" } },
          description: { type: "string" },
        },
      },
      Product: {
        allOf: [
          { $ref: "#/components/schemas/ProductInput" },
          {
            type: "object",
            properties: {
              id: { type: "string" },
              reserved_stock: { type: "integer" },
              available_stock: { type: "integer" },
              seller: { type: "object", properties: { id: { type: "string" } } },
            },
          },
        ],
      },
      ReservationInput: {
        type: "object",
        required: ["items"],
        properties: {
          items: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              required: ["product_id", "quantity"],
              properties: {
                product_id: { type: "string" },
                quantity: { type: "integer", minimum: 1 },
              },
            },
          },
        },
      },
      ImagePresignInput: {
        type: "object",
        required: ["filename", "content_type", "size"],
        properties: {
          filename: { type: "string", example: "product.png" },
          content_type: {
            type: "string",
            enum: ["image/jpeg", "image/png", "image/webp", "image/gif"],
          },
          size: { type: "integer", minimum: 1, example: 250000 },
        },
      },
    },
    responses: {
      BadRequest: { description: "Invalid request" },
      NotFound: { description: "Resource not found" },
    },
  },
};
