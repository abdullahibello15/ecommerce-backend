import { Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { AuthRequest } from "../types";
import { sendSuccess, sendError } from "../utils/response";
import prisma from "../config/prisma";

// ─── DISPATCHER ───────────────────────────────────────────────────────────────
const dispatchWebhook = async (
  endpoint: { id: string; url: string; secret: string },
  event: object,
  attempt = 1,
): Promise<void> => {
  const deliveryId = uuidv4();
  const payload = JSON.stringify(event);
  const startTime = Date.now();

  const signature = crypto
    .createHmac("sha512", endpoint.secret)
    .update(payload)
    .digest("hex");

  let statusCode: number | null = null;
  let responseBody: string | null = null;
  let success = false;

  try {
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-signature": signature,
        "x-webhook-id": deliveryId,
        "x-webhook-attempt": String(attempt),
      },
      body: payload,
      signal: AbortSignal.timeout(10_000),
    });

    statusCode = response.status;
    responseBody = await response.text();
    success = response.ok;
  } catch (err: any) {
    responseBody = err.message;
  }

  const duration = Date.now() - startTime;

  await prisma.webhookDelivery.create({
    data: {
      id: deliveryId,
      endpointId: endpoint.id,
      event: (event as any).event,
      payload: event,
      statusCode,
      responseBody,
      success,
      attempt,
      duration,
    },
  });

  if (!success && attempt < 4) {
    const delay = Math.pow(2, attempt) * 1000;
    setTimeout(() => dispatchWebhook(endpoint, event, attempt + 1), delay);
  }
};

// ─── GET /api/webhooks/endpoints ──────────────────────────────────────────────
export const getWebhookEndpoints = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { deliveries: true } },
      },
    });

    const safe = endpoints.map(({ secret, ...e }) => ({
      ...e,
      secret: `whsec_...${secret.slice(-4)}`,
    }));

    sendSuccess(res, safe);
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/webhooks/endpoints ─────────────────────────────────────────────
export const createWebhookEndpoint = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { url, description, events } = req.body;

    if (!url || !events || !Array.isArray(events) || events.length === 0) {
      sendError(res, "url and events[] are required");
      return;
    }

    try {
      new URL(url);
    } catch {
      sendError(res, "Invalid URL format");
      return;
    }

    const secret = `whsec_${crypto.randomBytes(24).toString("hex")}`;

    const endpoint = await prisma.webhookEndpoint.create({
      data: { url, description, events, secret },
    });

    sendSuccess(
      res,
      {
        ...endpoint,
        secret,
      },
      201,
      "Webhook endpoint created",
    );
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/webhooks/endpoints/:id ───────────────────────────────────────
export const deleteWebhookEndpoint = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const existing = await prisma.webhookEndpoint.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      sendError(res, "Endpoint not found", 404);
      return;
    }

    await prisma.webhookEndpoint.delete({ where: { id: req.params.id } });
    sendSuccess(res, null, 200, "Webhook endpoint deleted");
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/webhooks/endpoints/:id ──────────────────────────────────────────
export const updateWebhookEndpoint = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { isActive, events, description } = req.body;
    const existing = await prisma.webhookEndpoint.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      sendError(res, "Endpoint not found", 404);
      return;
    }

    const updated = await prisma.webhookEndpoint.update({
      where: { id: req.params.id },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(events && { events }),
        ...(description !== undefined && { description }),
      },
    });

    sendSuccess(res, {
      ...updated,
      secret: `whsec_...${updated.secret.slice(-4)}`,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/webhooks/endpoints/:id/deliveries ───────────────────────────────
export const getWebhookDeliveries = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const deliveries = await prisma.webhookDelivery.findMany({
      where: { endpointId: req.params.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    sendSuccess(res, deliveries);
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/webhooks/paystack ──────────────────────────────────────────────
export const receivePaystackWebhook = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  res.sendStatus(200);

  try {
    const hash = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      console.error("Invalid Paystack signature");
      return;
    }

    const event = req.body;
    const merchantId = event.data?.metadata?.merchantId;

    if (!merchantId) {
      console.error("No merchantId in webhook metadata");
      return;
    }

    const endpoints = await prisma.webhookEndpoint.findMany({
      where: {
        isActive: true,
        events: { has: event.event },
      },
    });

    if (endpoints.length === 0) return;

    await Promise.allSettled(
      endpoints.map((endpoint) => dispatchWebhook(endpoint, event)),
    );
  } catch (err) {
    console.error("Paystack webhook error:", err);
  }
};
