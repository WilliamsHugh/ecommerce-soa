export const openapi = {
  openapi: "3.0.3",
  info: {
    title: "User Service API",
    version: "1.0.0",
    description: "Authentication, profile management and RBAC.",
  },
  servers: [
    {
      url: "/",
      description: "Current user-service origin (local or deployed)",
    },
  ],
  tags: [{ name: "Auth" }, { name: "Users" }, { name: "Administration" }],
  paths: {
    "/api/v1/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a buyer account",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/RegisterRequest" } },
          },
        },
        responses: {
          201: {
            description: "Account created",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } },
            },
          },
          409: { $ref: "#/components/responses/Conflict" },
        },
      },
    },
    "/api/v1/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", format: "password" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Authenticated user and JWT pair",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthResponse" },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/v1/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Rotate refresh token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["refresh_token"],
                properties: { refresh_token: { type: "string" } },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Rotated token pair and current user",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/api/v1/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout current session",
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { refresh_token: { type: "string" } },
              },
            },
          },
        },
        responses: { 204: { description: "Access token revoked" } },
      },
    },
    "/api/v1/auth/logout-all": {
      post: {
        tags: ["Auth"],
        summary: "Revoke all refresh sessions",
        security: [{ bearerAuth: [] }],
        responses: { 204: { description: "All sessions revoked" } },
      },
    },
    "/api/v1/auth/change-password": {
      post: {
        tags: ["Auth"],
        summary: "Change password and revoke all sessions",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["current_password", "new_password"],
                properties: {
                  current_password: { type: "string", format: "password" },
                  new_password: { type: "string", format: "password", minLength: 8 },
                },
              },
            },
          },
        },
        responses: { 204: { description: "Password changed" } },
      },
    },
    "/api/v1/auth/forgot-password": {
      post: {
        tags: ["Auth"],
        summary: "Request a single-use password reset token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: { email: { type: "string", format: "email" } },
              },
            },
          },
        },
        responses: { 202: { description: "Request accepted regardless of account existence" } },
      },
    },
    "/api/v1/auth/reset-password": {
      post: {
        tags: ["Auth"],
        summary: "Reset password with a single-use token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["reset_token", "new_password"],
                properties: {
                  reset_token: { type: "string", format: "uuid" },
                  new_password: { type: "string", format: "password", minLength: 8 },
                },
              },
            },
          },
        },
        responses: { 204: { description: "Password reset" } },
      },
    },
    "/api/v1/users": {
      get: {
        tags: ["Administration"],
        summary: "List and filter users (ADMIN)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["ACTIVE", "INACTIVE", "BANNED"] },
          },
          {
            name: "role",
            in: "query",
            schema: { type: "string", enum: ["BUYER", "SELLER", "ADMIN"] },
          },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: { 200: { description: "Paginated users" } },
      },
    },
    "/api/v1/users/audit-logs": {
      get: {
        tags: ["Administration"],
        summary: "List security audit logs (ADMIN)",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Paginated audit logs" } },
      },
    },
    "/api/v1/users/me": {
      get: {
        tags: ["Users"],
        summary: "Get current authenticated user",
        description: "Resolves the user from the JWT subject claim (sub).",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Current user profile",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { data: { $ref: "#/components/schemas/User" } },
                },
              },
            },
          },
          401: { $ref: "#/components/responses/Unauthorized" },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        tags: ["Users"],
        summary: "Update current profile",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username"],
                properties: { username: { type: "string", minLength: 3, maxLength: 100 } },
              },
            },
          },
        },
        responses: { 200: { description: "Profile updated" } },
      },
    },
    "/api/v1/users/{id}": {
      get: {
        tags: ["Users"],
        summary: "Get profile",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/Id" }],
        responses: {
          200: {
            description: "User profile",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { data: { $ref: "#/components/schemas/User" } },
                },
              },
            },
          },
          404: { $ref: "#/components/responses/NotFound" },
        },
      },
      put: {
        tags: ["Users"],
        summary: "Update profile",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/Id" }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  username: { type: "string" },
                  status: { type: "string", enum: ["ACTIVE", "INACTIVE", "BANNED"] },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Updated user" } },
      },
      delete: {
        tags: ["Users"],
        summary: "Delete user (ADMIN)",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/Id" }],
        responses: { 204: { description: "Deleted" } },
      },
    },
    "/api/v1/users/{id}/roles": {
      post: {
        tags: ["Users"],
        summary: "Assign role (ADMIN)",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/Id" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["role"],
                properties: { role: { type: "string", enum: ["BUYER", "SELLER", "ADMIN"] } },
              },
            },
          },
        },
        responses: { 201: { description: "Role assigned" } },
      },
      delete: {
        tags: ["Administration"],
        summary: "Remove role (ADMIN)",
        security: [{ bearerAuth: [] }],
        parameters: [{ $ref: "#/components/parameters/Id" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["role"],
                properties: { role: { type: "string", enum: ["BUYER", "SELLER", "ADMIN"] } },
              },
            },
          },
        },
        responses: {
          200: { description: "Role removed" },
          409: { description: "Cannot remove the last role" },
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
      RegisterRequest: {
        type: "object",
        required: ["email", "username", "password"],
        properties: {
          email: { type: "string", format: "email" },
          username: { type: "string" },
          password: { type: "string", format: "password", minLength: 8 },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string", format: "email" },
          username: { type: "string" },
          roles: { type: "array", items: { type: "string", enum: ["BUYER", "SELLER", "ADMIN"] } },
          status: { type: "string", enum: ["ACTIVE", "INACTIVE", "BANNED"] },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      Tokens: {
        type: "object",
        properties: {
          access_token: { type: "string" },
          refresh_token: { type: "string" },
          token_type: { type: "string", example: "Bearer" },
          expires_in: { type: "integer", example: 3600 },
        },
      },
      AuthResponse: {
        allOf: [
          { $ref: "#/components/schemas/Tokens" },
          { type: "object", properties: { data: { $ref: "#/components/schemas/User" } } },
        ],
      },
      Error: { type: "object", properties: { error: { type: "string" } } },
    },
    responses: {
      Unauthorized: {
        description: "Unauthorized",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      NotFound: { description: "Not found" },
      Conflict: { description: "Resource already exists" },
    },
  },
};
