const number = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: number(process.env.PORT, 3001),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  accessSecret:
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "development-secret-change-me",
  refreshSecret:
    process.env.JWT_REFRESH_SECRET ||
    process.env.JWT_SECRET ||
    "development-refresh-secret-change-me",
  accessTtl: process.env.JWT_ACCESS_TTL || "1h",
  refreshTtl: process.env.JWT_REFRESH_TTL || "7d",
  jwtIssuer: process.env.JWT_ISSUER || "ecommerce-user-service",
  jwtAudience: process.env.JWT_AUDIENCE || "ecommerce-api",
  loginRateLimit: number(process.env.LOGIN_RATE_LIMIT, 10),
  loginRateWindowSeconds: number(process.env.LOGIN_RATE_WINDOW_SECONDS, 900),
  passwordResetTtlSeconds: number(process.env.PASSWORD_RESET_TTL_SECONDS, 900),
  mysql: {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: number(process.env.MYSQL_PORT, 3306),
    database: process.env.MYSQL_DATABASE || "ecommerce_users",
    user: process.env.MYSQL_USER || "ecommerce_user",
    password: process.env.MYSQL_PASSWORD || "",
    connectionLimit: number(process.env.MYSQL_CONNECTION_LIMIT, 10),
  },
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  redisKeyPrefix: process.env.REDIS_KEY_PREFIX || "ecommerce:user-service:",
  useMemoryStores: process.env.USER_STORE_DRIVER === "memory",
};

export function assertProductionSecrets() {
  if (env.nodeEnv !== "production") return;
  if (env.accessSecret.includes("development") || env.refreshSecret.includes("development")) {
    throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be configured in production");
  }
}
