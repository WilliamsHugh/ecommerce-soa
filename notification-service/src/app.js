import express from "express";
import swaggerUi from "swagger-ui-express";
import { openapi } from "./config/swagger.js";
import notificationRoutes from "./routes/notification.routes.js";
import { notificationStore } from "./stores/notification.store.js";
import cors from "cors";
import helmet from "helmet";

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(cors());
app.use(express.json());
app.get("/api-docs.json", (_req, res) => res.json(openapi));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapi));
app.get("/health", (_req, res) =>
  res.json({ service: "notification-service", status: "ok" }),
);
app.get("/ready", async (_req, res) => {
  try {
    await notificationStore.check();
    res.json({
      service: "notification-service",
      status: "ready",
      database: "up",
    });
  } catch {
    res.status(503).json({
      service: "notification-service",
      status: "not-ready",
      database: "down",
    });
  }
});
app.use("/api/v1", notificationRoutes);
export default app;
