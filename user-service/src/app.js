import express from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { checkDatabase } from "./config/database.js";
import { env } from "./config/env.js";
import { checkRedis } from "./config/redis.js";
import { openapi } from "./config/swagger.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: env.corsOrigin.split(",").map((origin) => origin.trim()) }));
app.use(express.json({ limit: "1mb" }));
app.get("/api-docs.json", (_req, res) => res.json(openapi));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapi));

app.get("/health", (_req, res) => res.json({ service: "user-service", status: "ok" }));
app.get("/ready", async (_req, res) => {
  try {
    await Promise.all([checkDatabase(), checkRedis()]);
    res.json({ service: "user-service", status: "ready", mysql: "up", redis: "up" });
  } catch {
    res.status(503).json({ service: "user-service", status: "not-ready" });
  }
});

app.use("/api/v1/auth", authRoutes);

app.use("/api/v1/users", userRoutes);

app.use((_req, res) => res.status(404).json({ error: "Route not found" }));

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error", request_id: req.headers["x-request-id"] });
});
export default app;
