import { Router } from "express";
import express from "express";
import {
  getWebhookEndpoints,
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  updateWebhookEndpoint,
  getWebhookDeliveries,
  receivePaystackWebhook,
} from "../controllers/webhook.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

//Public — no auth (Paystack calls this directly)
router.post("/paystack", express.json(), receivePaystackWebhook);

//Protected routes — require auth
router.use(authenticate);

router.get("/endpoints", getWebhookEndpoints);
router.post("/endpoints", createWebhookEndpoint);
router.put("/endpoints/:id", updateWebhookEndpoint);
router.delete("/endpoints/:id", deleteWebhookEndpoint);
router.get("/endpoints/:id/deliveries", getWebhookDeliveries);

export default router;
