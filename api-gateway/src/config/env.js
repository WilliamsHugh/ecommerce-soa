const numberFromEnv = (name, fallback) => {
  const value = Number(process.env[name] || fallback);
  if (!Number.isFinite(value) || value <= 0)
    throw new Error(`${name} must be a positive number`);
  return value;
};

const urlFromEnv = (name, fallback) => {
  const value = process.env[name] || fallback;
  try {
    return new URL(value).origin;
  } catch {
    throw new Error(`${name} must be a valid absolute URL`);
  }
};

export const env = {
  port: numberFromEnv("PORT", 3000),
  nodeEnv: process.env.NODE_ENV || "development",
  corsOrigins: (process.env.CORS_ORIGIN || "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  jwtSecret:
    process.env.JWT_ACCESS_SECRET ||
    process.env.JWT_SECRET ||
    "development-secret-change-me",
  jwtIssuer: process.env.JWT_ISSUER || "ecommerce-user-service",
  jwtAudience: process.env.JWT_AUDIENCE || "ecommerce-api",
  upstreamTimeoutMs: numberFromEnv("UPSTREAM_TIMEOUT_MS", 5000),
  readinessTimeoutMs: numberFromEnv("READINESS_TIMEOUT_MS", 3000),
  rateLimitWindowMs: numberFromEnv("RATE_LIMIT_WINDOW_MS", 60_000),
  rateLimitMax: numberFromEnv("RATE_LIMIT_MAX", 100),
  maxBodyBytes: numberFromEnv("MAX_BODY_BYTES", 2 * 1024 * 1024),
  services: {
    user: urlFromEnv("USER_SERVICE_URL", "http://127.0.0.1:3001"),
    product: urlFromEnv("PRODUCT_SERVICE_URL", "http://127.0.0.1:3002"),
    order: urlFromEnv("ORDER_SERVICE_URL", "http://127.0.0.1:3003"),
    payment: urlFromEnv("PAYMENT_SERVICE_URL", "http://127.0.0.1:3004"),
    notification: urlFromEnv(
      "NOTIFICATION_SERVICE_URL",
      "http://127.0.0.1:3005",
    ),
  },
};

export function assertProductionConfig() {
  if (
    env.nodeEnv === "production" &&
    env.jwtSecret === "development-secret-change-me"
  )
    throw new Error("JWT_ACCESS_SECRET must be configured in production");
}
