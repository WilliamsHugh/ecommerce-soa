const bool = (value, fallback = false) =>
  value === undefined
    ? fallback
    : ["1", "true", "yes"].includes(String(value).toLowerCase());

export const env = {
  port: Number(process.env.PORT || 3005),
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret:
    process.env.JWT_ACCESS_SECRET ||
    process.env.JWT_SECRET ||
    "development-secret-change-me",
  jwtIssuer: process.env.JWT_ISSUER || "ecommerce-user-service",
  jwtAudience: process.env.JWT_AUDIENCE || "ecommerce-api",
  storeDriver: process.env.NOTIFICATION_STORE_DRIVER || "memory",
  databaseUrl: process.env.DATABASE_URL || "",
  databaseSsl: bool(process.env.DATABASE_SSL),
  internalServiceSecret: process.env.INTERNAL_SERVICE_SECRET || "",
  deliveryProviderUrl: process.env.DELIVERY_PROVIDER_URL || "",
  dependencyTimeoutMs: Number(process.env.DEPENDENCY_TIMEOUT_MS || 5000),
  dependencyRetries: Number(process.env.DEPENDENCY_RETRIES || 2),
};

export function assertProductionConfig() {
  if (
    env.nodeEnv === "production" &&
    env.jwtSecret === "development-secret-change-me"
  )
    throw new Error("JWT_ACCESS_SECRET must be configured in production");
  if (env.storeDriver === "postgres" && !env.databaseUrl)
    throw new Error(
      "DATABASE_URL is required when NOTIFICATION_STORE_DRIVER=postgres",
    );
}
