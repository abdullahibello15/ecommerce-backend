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

// ─── POST /api/gateways/:id/test ─────────────────────────────────────────────
export const testGateway = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;

    const gateway = await prisma.gateway.findUnique({ where: { id } });
    if (!gateway) {
      sendError(res, "Gateway not found", 404);
      return;
    }

    // ── FIX: fall back to env var if the DB record has no secret key ──
    const secretKey = gateway.secretKey || process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      sendError(res, "Gateway has no secret key configured", 400);
      return;
    }

    // Test connectivity by hitting the gateway's verification endpoint
    const startTime = Date.now();
    let success = false;
    let message = "";

    try {
      const response = await fetch(
        "https://api.paystack.co/transaction/verify/test",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${secretKey}`,
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(10_000),
        },
      );

      // A 401 means the key is wrong, anything else means we reached Paystack
      success = response.status !== 401;
      message = success
        ? "Gateway credentials are valid"
        : "Invalid secret key — authorization failed";
    } catch (err: any) {
      message = `Connection failed: ${err.message}`;
    }

    const duration = Date.now() - startTime;

    // Log the test attempt
    await prisma.gatewayLog.create({
      data: {
        gatewayId: id,
        event: "gateway.tested",
        payload: {
          testedBy: req.user?.userId,
          success,
          message,
          duration,
        },
      },
    });

    if (!success) {
      sendError(res, message, 400);
      return;
    }

    sendSuccess(
      res,
      { success, message, duration },
      200,
      "Gateway test complete",
    );
  } catch (err) {
    next(err);
  }
};
