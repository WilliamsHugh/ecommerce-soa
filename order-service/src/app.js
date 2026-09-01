import express from "express";
import swaggerUi from "swagger-ui-express";
import { openapi } from "./config/swagger.js";
import { paymentSuccess } from "./controllers/order.controller.js";
import orderRoutes from "./routes/order.routes.js";

const app = express();
app.use(express.json());
app.get("/api-docs.json", (_req, res) => res.json(openapi));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapi));
app.get("/health", (_req, res) => res.json({ service: "order-service", status: "ok" }));
app.use("/api/v1/orders", orderRoutes);
app.post("/api/v1/internal/orders/:id/payment-success", paymentSuccess);
export default app;
