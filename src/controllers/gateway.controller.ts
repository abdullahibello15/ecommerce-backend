import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response';
import prisma from '../config/prisma';

// ─── GET /api/gateways ────────────────────────────────────────────────────────
export const getGateways = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const gateways = await prisma.gateway.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, displayName: true, isActive: true,
        webhookUrl: true, config: true, createdAt: true, updatedAt: true,
        // Never return secret keys in list
      },
    });
    sendSuccess(res, gateways);
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/gateways/:id ────────────────────────────────────────────────────
export const getGateway = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const gateway = await prisma.gateway.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, name: true, displayName: true, isActive: true,
        publicKey: true, webhookUrl: true, config: true, createdAt: true,
        // secretKey omitted even here — only return masked version
      },
    });
    if (!gateway) { sendError(res, 'Gateway not found', 404); return; }
    sendSuccess(res, gateway);
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/gateways/:id ────────────────────────────────────────────────────
export const updateGateway = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { isActive, publicKey, secretKey, webhookUrl, config } = req.body;

    const existing = await prisma.gateway.findUnique({ where: { id } });
    if (!existing) { sendError(res, 'Gateway not found', 404); return; }

    const updated = await prisma.gateway.update({
      where: { id },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(publicKey && { publicKey }),
        ...(secretKey && { secretKey }),
        ...(webhookUrl && { webhookUrl }),
        ...(config && { config }),
      },
      select: {
        id: true, name: true, displayName: true, isActive: true,
        publicKey: true, webhookUrl: true, config: true, updatedAt: true,
      },
    });

    // Log the update
    await prisma.gatewayLog.create({
      data: {
        gatewayId: id,
        event: 'gateway.updated',
        payload: { updatedBy: req.user!.userId, changes: Object.keys(req.body) },
      },
    });

    sendSuccess(res, updated, 200, 'Gateway updated');
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/gateways/:id/logs ───────────────────────────────────────────────
export const getGatewayLogs = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const [logs, total] = await Promise.all([
      prisma.gatewayLog.findMany({
        where: { gatewayId: id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.gatewayLog.count({ where: { gatewayId: id } }),
    ]);

    res.json({
      success: true,
      data: logs,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};
