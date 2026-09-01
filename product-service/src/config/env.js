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
  elasticsearchUrl: process.env.ELASTICSEARCH_URL || "http://127.0.0.1:9200",
  elasticsearchIndex: process.env.ELASTICSEARCH_INDEX || "products",
  elasticsearchUsername: process.env.ELASTICSEARCH_USERNAME || "",
  elasticsearchPassword: process.env.ELASTICSEARCH_PASSWORD || "",
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
  if (env.productStoreDriver !== "elasticsearch")
    throw new Error("PRODUCT_STORE_DRIVER must be elasticsearch in production");
}
