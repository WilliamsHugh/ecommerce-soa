import express from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { openapi } from "./config/swagger.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import productRoutes from "./routes/product.routes.js";
import imageRoutes from "./routes/image.routes.js";
import { env } from "./config/env.js";
import { checkCatalogStore, checkImageStore } from "./services/catalog.service.js";

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: (env.corsOrigin || "http://localhost:3000").split(",").map((item) => item.trim()),
  }),
);
app.use(express.json({ limit: "1mb" }));
app.get("/api-docs.json", (_req, res) => res.json(openapi));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapi));
app.get("/health", (_req, res) => res.json({ service: "product-service", status: "ok" }));
app.get("/ready", async (_req, res) => {
  try {
    const [catalog, images] = await Promise.all([checkCatalogStore(), checkImageStore()]);
    res.json({
      service: "product-service",
      status: "ready",
      catalog: catalog ? "up" : "down",
      images: images ? "up" : "down",
    });
  } catch {
    res.status(503).json({ service: "product-service", status: "not-ready" });
  }
});
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/products", imageRoutes);
app.use("/api/v1/inventory", inventoryRoutes);
app.use((_req, res) => res.status(404).json({ error: "Route not found" }));
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});
export default app;
