import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response';
import prisma from '../config/prisma';

export const globalSearch = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const q = (req.query.q as string)?.trim();
    if (!q || q.length < 2) {
      sendError(res, 'Search query must be at least 2 characters');
      return;
    }

    const [transactions, gateways] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          OR: [
            { reference: { contains: q, mode: 'insensitive' } },
            { customerEmail: { contains: q, mode: 'insensitive' } },
            { customerName: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: 5,
        select: { id: true, reference: true, amount: true, currency: true, status: true, customerEmail: true, createdAt: true },
      }),
      prisma.gateway.findMany({
        where: { displayName: { contains: q, mode: 'insensitive' } },
        take: 3,
        select: { id: true, name: true, displayName: true, isActive: true },
      }),
    ]);

    sendSuccess(res, {
      query: q,
      results: {
        transactions: transactions.map((t) => ({ ...t, type: 'transaction' })),
        gateways: gateways.map((g) => ({ ...g, type: 'gateway' })),
      },
      total: transactions.length + gateways.length,
    });
  } catch (err) { next(err); }
};
