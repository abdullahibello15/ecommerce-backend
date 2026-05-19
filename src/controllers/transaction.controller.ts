import { Response, NextFunction } from 'express';
import { AuthRequest, TransactionFilters } from '../types';
import { sendSuccess, sendPaginated, sendError } from '../utils/response';
import prisma from '../config/prisma';

// ─── GET /api/transactions ────────────────────────────────────────────────────
export const getTransactions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      status,
      gateway,
      startDate,
      endDate,
      search,
      page = '1',
      limit = '20',
    } = req.query as TransactionFilters;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Build dynamic where clause
    const where: Record<string, unknown> = {};

    if (status) where.status = status.toUpperCase();
    if (gateway) where.gateway = gateway.toLowerCase();
    if (startDate || endDate) {
      where.createdAt = {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)) }),
      };
    }
    if (search) {
      where.OR = [
        { reference: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.transaction.count({ where }),
    ]);

    sendPaginated(res, transactions, total, pageNum, limitNum);
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/transactions/export ─────────────────────────────────────────────
export const exportTransactions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, gateway, startDate, endDate, format = 'csv' } = req.query as {
      status?: string; gateway?: string;
      startDate?: string; endDate?: string; format?: string;
    };

    const where: Record<string, unknown> = {};
    if (status) where.status = status.toUpperCase();
    if (gateway) where.gateway = gateway;
    if (startDate || endDate) {
      where.createdAt = {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)) }),
      };
    }

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000, // safety cap
    });

    if (format === 'csv') {
      const rows = transactions.map((t) => ({
        Reference: t.reference,
        Amount: t.amount,
        Currency: t.currency,
        Status: t.status,
        Gateway: t.gateway,
        Customer: t.customerName || '',
        Email: t.customerEmail,
        Date: t.createdAt.toISOString(),
        'Paid At': t.paidAt?.toISOString() || '',
      }));

      const headers = Object.keys(rows[0] || {});
      const csvRows = [
        headers.join(','),
        ...rows.map((r) =>
          headers.map((h) => `"${String(r[h as keyof typeof r]).replace(/"/g, '""')}"`).join(',')
        ),
      ];

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=transactions-${Date.now()}.csv`);
      res.send(csvRows.join('\n'));
    } else {
      // JSON export
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=transactions-${Date.now()}.json`);
      res.send(JSON.stringify(transactions, null, 2));
    }
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/transactions/:reference ─────────────────────────────────────────
export const getTransaction = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { reference } = req.params;

    const transaction = await prisma.transaction.findUnique({
      where: { reference },
    });

    if (!transaction) {
      sendError(res, 'Transaction not found', 404);
      return;
    }

    sendSuccess(res, transaction);
  } catch (err) {
    next(err);
  }
};
