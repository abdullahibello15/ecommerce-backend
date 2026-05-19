import { Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response';
import prisma from '../config/prisma';

// ─── GET /api/webhooks/endpoints ──────────────────────────────────────────────
export const getWebhookEndpoints = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { deliveries: true } },
      },
    });

    // Mask secret
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
  next: NextFunction
): Promise<void> => {
  try {
    const { url, description, events } = req.body;

    if (!url || !events || !Array.isArray(events) || events.length === 0) {
      sendError(res, 'url and events[] are required');
      return;
    }

    // Validate URL
    try { new URL(url); } catch {
      sendError(res, 'Invalid URL format');
      return;
    }

    const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

    const endpoint = await prisma.webhookEndpoint.create({
      data: { url, description, events, secret },
    });

    sendSuccess(res, {
      ...endpoint,
      secret, // Return full secret only on creation
    }, 201, 'Webhook endpoint created');
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/webhooks/endpoints/:id ───────────────────────────────────────
export const deleteWebhookEndpoint = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const existing = await prisma.webhookEndpoint.findUnique({ where: { id: req.params.id } });
    if (!existing) { sendError(res, 'Endpoint not found', 404); return; }

    await prisma.webhookEndpoint.delete({ where: { id: req.params.id } });
    sendSuccess(res, null, 200, 'Webhook endpoint deleted');
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/webhooks/endpoints/:id ──────────────────────────────────────────
export const updateWebhookEndpoint = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { isActive, events, description } = req.body;
    const existing = await prisma.webhookEndpoint.findUnique({ where: { id: req.params.id } });
    if (!existing) { sendError(res, 'Endpoint not found', 404); return; }

    const updated = await prisma.webhookEndpoint.update({
      where: { id: req.params.id },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(events && { events }),
        ...(description !== undefined && { description }),
      },
    });

    sendSuccess(res, { ...updated, secret: `whsec_...${updated.secret.slice(-4)}` });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/webhooks/endpoints/:id/deliveries ───────────────────────────────
export const getWebhookDeliveries = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const deliveries = await prisma.webhookDelivery.findMany({
      where: { endpointId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    sendSuccess(res, deliveries);
  } catch (err) {
    next(err);
  }
};
