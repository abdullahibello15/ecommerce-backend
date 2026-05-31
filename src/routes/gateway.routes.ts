import { Router } from "express";
import {
  createGateway,
  getGateways,
  getGateway,
  updateGateway,
  getGatewayLogs,
  testGateway,
} from "../controllers/gateway.controller";
import { authenticate, requireRole } from "../middleware/auth";

const router = Router();

router.use(authenticate);

router.post("/", requireRole("OWNER", "ADMIN"), createGateway);
router.get("/", getGateways);
router.get("/:id", getGateway);
router.put("/:id", requireRole("OWNER", "ADMIN"), updateGateway);
router.get("/:id/logs", getGatewayLogs);
router.post("/:id/test", requireRole("OWNER", "ADMIN"), testGateway);

export default router;
