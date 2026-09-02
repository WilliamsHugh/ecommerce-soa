const number = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: number(process.env.PORT, 3002),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  accessSecret:
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "development-secret-change-me",
  jwtIssuer: process.env.JWT_ISSUER || "ecommerce-user-service",
  jwtAudience: process.env.JWT_AUDIENCE || "ecommerce-api",
  productStoreDriver: process.env.PRODUCT_STORE_DRIVER || "memory",
  mongodbUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017",
  mongodbDatabase: process.env.MONGODB_DATABASE || "product_service",
  mongodbProductsCollection: process.env.MONGODB_PRODUCTS_COLLECTION || "products",
  mongodbReservationsCollection:
    process.env.MONGODB_RESERVATIONS_COLLECTION || "reservations",
  mongodbConnectionTimeoutMs: number(process.env.MONGODB_CONNECTION_TIMEOUT_MS, 30_000),
  s3Endpoint: process.env.S3_ENDPOINT || "",
  s3HealthUrl: process.env.S3_HEALTH_URL || process.env.S3_ENDPOINT || "",
  s3Bucket: process.env.S3_BUCKET || "product-images",
  s3PublicUrl: process.env.S3_PUBLIC_URL || "",
  s3AccessKey: process.env.S3_ACCESS_KEY || "",
  s3SecretKey: process.env.S3_SECRET_KEY || "",
  maxImageBytes: number(process.env.MAX_IMAGE_BYTES, 5 * 1024 * 1024),
};

export function assertProductionConfig() {
  if (env.nodeEnv !== "production") return;
  if (env.accessSecret.includes("development"))
    throw new Error("JWT_ACCESS_SECRET must be configured in production");
  if (env.productStoreDriver !== "mongodb")
    throw new Error("PRODUCT_STORE_DRIVER must be mongodb in production");
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI must be configured in production");
}
