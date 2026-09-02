const asBoolean = (value, fallback = false) =>
  value === undefined
    ? fallback
    : ["1", "true", "yes"].includes(String(value).toLowerCase());

export const env = {
  port: Number(process.env.PORT || 3004),
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_ACCESS_SECRET || "development-secret-change-me",
  jwtIssuer: process.env.JWT_ISSUER || "ecommerce-user-service",
  jwtAudience: process.env.JWT_AUDIENCE || "ecommerce-api",
  paymentStoreDriver: process.env.PAYMENT_STORE_DRIVER || "memory",
  databaseUrl: process.env.DATABASE_URL || "",
  databaseSsl: asBoolean(process.env.DATABASE_SSL),
  orderServiceUrl: process.env.ORDER_SERVICE_URL || "http://127.0.0.1:3003",
  internalServiceSecret: process.env.INTERNAL_SERVICE_SECRET || "",
  dependencyTimeoutMs: Number(process.env.DEPENDENCY_TIMEOUT_MS || 5000),
  dependencyRetries: Number(process.env.DEPENDENCY_RETRIES || 2),
  corsOrigins: (process.env.CORS_ORIGIN || "http://localhost:3000")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  gatewayProvider: process.env.PAYMENT_GATEWAY_PROVIDER || "soap_sandbox",
  gatewayApiUrl: process.env.PAYMENT_GATEWAY_API_URL || "",
  gatewayApiKey: process.env.PAYMENT_GATEWAY_API_KEY || "",
  outboxPollMs: Number(process.env.OUTBOX_POLL_MS || 1000),
};

export function assertProductionConfig() {
  if (!["soap_sandbox", "http"].includes(env.gatewayProvider))
    throw new Error("PAYMENT_GATEWAY_PROVIDER must be soap_sandbox or http");
  if (
    env.nodeEnv === "production" &&
    env.jwtSecret === "development-secret-change-me"
  )
    throw new Error("JWT_ACCESS_SECRET must be configured in production");
  if (env.nodeEnv === "production" && !env.internalServiceSecret)
    throw new Error("INTERNAL_SERVICE_SECRET must be configured in production");
  if (env.paymentStoreDriver === "postgres" && !env.databaseUrl)
    throw new Error(
      "DATABASE_URL is required when PAYMENT_STORE_DRIVER=postgres",
    );
  if (env.nodeEnv === "production" && env.paymentStoreDriver !== "postgres")
    throw new Error("PAYMENT_STORE_DRIVER=postgres is required in production");
  if (
    env.gatewayProvider === "http" &&
    (!env.gatewayApiUrl || !env.gatewayApiKey)
  )
    throw new Error(
      "PAYMENT_GATEWAY_API_URL and PAYMENT_GATEWAY_API_KEY are required for the http provider",
    );
}
