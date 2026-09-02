import express from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { openapi } from "./config/swagger.js";
import { authenticate } from "./middlewares/auth.middleware.js";
import { rateLimit } from "./middlewares/rate-limit.middleware.js";
import { requestId } from "./middlewares/request-id.middleware.js";
import { checkUpstreams, proxyRequest } from "./services/proxy.service.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: env.corsOrigins }));
app.use(requestId);
app.use(rateLimit);
app.get("/api-docs.json", (_req, res) => res.json(openapi));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapi));
app.get("/health", (_req, res) =>
  res.json({ service: "api-gateway", status: "ok" }),
);
app.get("/ready", async (_req, res) => {
  const upstreams = await checkUpstreams();
  const ready = Object.values(upstreams).every((status) => status === "up");
  res.status(ready ? 200 : 503).json({
    service: "api-gateway",
    status: ready ? "ready" : "not-ready",
    upstreams,
  });
});
app.use(express.raw({ type: "*/*", limit: env.maxBodyBytes }));
app.use("/api/v1/:resource", authenticate, proxyRequest);
app.use((req, res) =>
  res.status(404).json({ error: "Route not found", request_id: req.requestId }),
);
app.use((err, req, res, _next) => {
  const tooLarge = err?.type === "entity.too.large";
  if (!tooLarge) console.error(err);
  res.status(tooLarge ? 413 : 500).json({
    error: tooLarge ? "Request body too large" : "Internal server error",
    request_id: req.requestId,
  });
});

export default app;
