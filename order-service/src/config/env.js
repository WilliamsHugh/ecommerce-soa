const asBoolean = (value, fallback = false) =>
  value === undefined ? fallback : ["1", "true", "yes"].includes(String(value).toLowerCase());

export const env = {
  port: Number(process.env.PORT || 3003),
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret:
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "development-secret-change-me",
  jwtIssuer: process.env.JWT_ISSUER || "ecommerce-user-service",
  jwtAudience: process.env.JWT_AUDIENCE || "ecommerce-api",
  orderStoreDriver: process.env.ORDER_STORE_DRIVER || "memory",
  databaseUrl: process.env.DATABASE_URL || "",
  databaseSsl: asBoolean(process.env.DATABASE_SSL),
  productServiceUrl: process.env.PRODUCT_SERVICE_URL || "http://127.0.0.1:3002",
  paymentServiceUrl: process.env.PAYMENT_SERVICE_URL || "http://127.0.0.1:3004",
  notificationServiceUrl: process.env.NOTIFICATION_SERVICE_URL || "http://127.0.0.1:3005",
  dependencyTimeoutMs: Number(process.env.DEPENDENCY_TIMEOUT_MS || 5000),
};

export function assertProductionConfig() {
  if (env.nodeEnv === "production" && env.jwtSecret === "development-secret-change-me")
    throw new Error("JWT_ACCESS_SECRET must be configured in production");
  if (env.orderStoreDriver === "postgres" && !env.databaseUrl)
    throw new Error("DATABASE_URL is required when ORDER_STORE_DRIVER=postgres");
}
