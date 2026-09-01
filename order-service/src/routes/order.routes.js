import { Router } from "express";
import { create, get, list, updateStatus } from "../controllers/order.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(authenticate);
router.post("/", create);
router.get("/", list);
router.get("/:id", get);
router.post("/:id/confirm", (req, res) => updateStatus(req, res, "CONFIRMED"));
router.post("/:id/cancel", (req, res) => updateStatus(req, res, "CANCELLED"));
router.patch("/:id/status", updateStatus);
export default router;
