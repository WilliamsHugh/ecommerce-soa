import express from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { openapi } from "./config/swagger.js";
import paymentRoutes from "./routes/payment.routes.js";
import soapRoutes from "./routes/soap.routes.js";
import { paymentStore } from "./stores/payment.store.js";
import { errorHandler, notFound } from "./middlewares/error.middleware.js";
const app = express();
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
      },
    },
  }),
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.corsOrigins.includes(origin))
        return callback(null, true);
      return callback(
        Object.assign(new Error("Origin is not allowed"), { status: 403 }),
      );
    },
  }),
);
app.use(express.json());
app.use(express.text({ type: ["text/xml", "application/soap+xml"] }));
app.get("/api-docs.json", (_req, res) => res.json(openapi));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapi));
app.get("/health", (_req, res) =>
  res.json({ service: "payment-service", status: "ok" }),
);
app.get("/ready", async (_req, res) => {
  try {
    await paymentStore.check();
    res.json({ service: "payment-service", status: "ready", database: "up" });
  } catch {
    res.status(503).json({
      service: "payment-service",
      status: "not-ready",
      database: "down",
    });
  }
});
app.use("/api/v1/payments", paymentRoutes);
app.use("/soap", soapRoutes);
app.use(notFound);
app.use(errorHandler);
export default app;
