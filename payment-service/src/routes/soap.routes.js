import { Router } from "express";
import { gateway, wsdl } from "../controllers/soap.controller.js";
import { authenticateInternal } from "../middlewares/internal.middleware.js";
const router = Router();
router.get("/payment.wsdl", wsdl);
router.post("/gateway", authenticateInternal, gateway);
export default router;
