import { Response, NextFunction } from "express";
import { AuthRequest } from "../types";
import { sendSuccess, sendError } from "../utils/response";
import prisma from "../config/prisma";

// ─── POST /api/gateways ───────────────────────────────────────────────────────
export const createGateway = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    let {
      name,
      displayName,
      isActive = false,
      publicKey,
      secretKey,
      webhookUrl,
      config,
    } = req.body;

    if (!name || !displayName) {
      sendError(res, "name and displayName are required");
      return;
    }

    name = String(name).trim().toLowerCase();
    displayName = String(displayName).trim();

    if (!/^[a-z0-9_-]+$/.test(name)) {
      sendError(
        res,
        "name must be lowercase and contain only letters, numbers, hyphens, or underscores",
      );
      return;
    }

    if (webhookUrl) {
      try {
        new URL(webhookUrl);
      } catch {
        sendError(res, "Invalid webhookUrl format");
        return;
      }
    }

    const existing = await prisma.gateway.findUnique({ where: { name } });
    if (existing) {
      sendError(res, "Gateway already exists", 409);
      return;
    }

    const gateway = await prisma.gateway.create({
      data: {
        name,
        displayName,
        isActive,
        publicKey: publicKey || null,
        secretKey: secretKey || null,
        webhookUrl: webhookUrl || null,
        config: config || null,
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        isActive: true,
        publicKey: true,
        webhookUrl: true,
        config: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await prisma.gatewayLog.create({
      data: {
        gatewayId: gateway.id,
        event: "gateway.created",
        payload: { createdBy: req.user?.userId, name, displayName, isActive },
      },
    });

    sendSuccess(res, gateway, 201, "Gateway created");
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/gateways ────────────────────────────────────────────────────────
export const getGateways = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const gateways = await prisma.gateway.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        displayName: true,
        isActive: true,
        webhookUrl: true,
        config: true,
        createdAt: true,
        updatedAt: true,
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
  next: NextFunction,
): Promise<void> => {
  try {
    const gateway = await prisma.gateway.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        displayName: true,
        isActive: true,
        publicKey: true,
        webhookUrl: true,
        config: true,
        createdAt: true,
        // secretKey omitted even here — only return masked version
      },
    });
    if (!gateway) {
      sendError(res, "Gateway not found", 404);
      return;
    }
    sendSuccess(res, gateway);
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/gateways/:id ────────────────────────────────────────────────────
export const updateGateway = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { isActive, publicKey, secretKey, webhookUrl, config } = req.body;

    const existing = await prisma.gateway.findUnique({ where: { id } });
    if (!existing) {
      sendError(res, "Gateway not found", 404);
      return;
    }

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
        id: true,
        name: true,
        displayName: true,
        isActive: true,
        publicKey: true,
        webhookUrl: true,
        config: true,
        updatedAt: true,
      },
    });

    // Log the update
    await prisma.gatewayLog.create({
      data: {
        gatewayId: id,
        event: "gateway.updated",
        payload: {
          updatedBy: req.user!.userId,
          changes: Object.keys(req.body),
        },
      },
    });

    sendSuccess(res, updated, 200, "Gateway updated");
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/gateways/:id/logs ───────────────────────────────────────────────
export const getGatewayLogs = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const [logs, total] = await Promise.all([
      prisma.gatewayLog.findMany({
        where: { gatewayId: id },
        orderBy: { createdAt: "desc" },
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
