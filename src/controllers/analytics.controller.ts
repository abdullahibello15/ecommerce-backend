import { Response, NextFunction } from 'express';
import { AuthRequest, AnalyticsDateRange } from '../types';
import { sendSuccess } from '../utils/response';
import prisma from '../config/prisma';

// Helper: build date filter from query params
function buildDateFilter(query: AnalyticsDateRange) {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = now;

  if (query.startDate) {
    startDate = new Date(query.startDate);
  } else {
    // Default: last 30 days
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
  }

  if (query.endDate) {
    endDate = new Date(query.endDate);
    endDate.setHours(23, 59, 59, 999);
  }

  return { startDate, endDate };
}

// ─── GET /api/analytics/revenue ───────────────────────────────────────────────
// Returns daily revenue chart data for the date range
export const getRevenueAnalytics = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { startDate, endDate } = buildDateFilter(req.query as AnalyticsDateRange);

    // Raw daily aggregation
    const rows = await prisma.$queryRaw<
      { date: Date; total: number; count: bigint }[]
    >`
      SELECT
        DATE_TRUNC('day', "createdAt") AS date,
        SUM(amount) AS total,
        COUNT(*) AS count
      FROM transactions
      WHERE
        "createdAt" BETWEEN ${startDate} AND ${endDate}
        AND status = 'SUCCESS'
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date ASC
    `;

    const chartData = rows.map((r) => ({
      date: r.date.toISOString().split('T')[0],
      revenue: Number(r.total),
      transactions: Number(r.count),
    }));

    // Fill in missing days with 0
    const filledData = fillDateGaps(chartData, startDate, endDate);

    sendSuccess(res, {
      currency: 'NGN',
      period: { startDate, endDate },
      chartData: filledData,
      total: filledData.reduce((sum, d) => sum + d.revenue, 0),
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/analytics/gateways ──────────────────────────────────────────────
// Returns gateway breakdown percentages + amounts
export const getGatewayAnalytics = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { startDate, endDate } = buildDateFilter(req.query as AnalyticsDateRange);

    const rows = await prisma.transaction.groupBy({
      by: ['gateway'],
      where: {
        status: 'SUCCESS',
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    const grandTotal = rows.reduce((sum, r) => sum + (r._sum.amount || 0), 0);

    const gateways = rows.map((r) => ({
      gateway: r.gateway,
      displayName: capitalize(r.gateway),
      amount: r._sum.amount || 0,
      count: r._count.id,
      percentage: grandTotal > 0 ? Math.round(((r._sum.amount || 0) / grandTotal) * 100) : 0,
      currency: 'NGN',
    }));

    sendSuccess(res, { gateways, total: grandTotal, currency: 'NGN' });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/analytics/kpis ──────────────────────────────────────────────────
// Returns KPI card data: revenue, transactions, success rate, avg value
export const getKPIs = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { startDate, endDate } = buildDateFilter(req.query as AnalyticsDateRange);

    // Previous period (same length, right before startDate)
    const periodLength = endDate.getTime() - startDate.getTime();
    const prevEnd = new Date(startDate.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - periodLength);

    const [current, previous] = await Promise.all([
      getKPIData(startDate, endDate),
      getKPIData(prevStart, prevEnd),
    ]);

    const calcChange = (curr: number, prev: number) =>
      prev === 0 ? 0 : Math.round(((curr - prev) / prev) * 100);

    sendSuccess(res, {
      currency: 'NGN',
      period: { startDate, endDate },
      kpis: {
        totalRevenue: {
          value: current.revenue,
          previousValue: previous.revenue,
          change: calcChange(current.revenue, previous.revenue),
          label: 'Total Revenue',
        },
        totalTransactions: {
          value: current.total,
          previousValue: previous.total,
          change: calcChange(current.total, previous.total),
          label: 'Total Transactions',
        },
        successRate: {
          value: current.successRate,
          previousValue: previous.successRate,
          change: calcChange(current.successRate, previous.successRate),
          label: 'Success Rate',
          unit: '%',
        },
        averageValue: {
          value: current.avgValue,
          previousValue: previous.avgValue,
          change: calcChange(current.avgValue, previous.avgValue),
          label: 'Avg Transaction Value',
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getKPIData(startDate: Date, endDate: Date) {
  const [all, successful] = await Promise.all([
    prisma.transaction.aggregate({
      where: { createdAt: { gte: startDate, lte: endDate } },
      _count: { id: true },
    }),
    prisma.transaction.aggregate({
      where: { createdAt: { gte: startDate, lte: endDate }, status: 'SUCCESS' },
      _count: { id: true },
      _sum: { amount: true },
      _avg: { amount: true },
    }),
  ]);

  const total = all._count.id;
  const successCount = successful._count.id;
  const revenue = successful._sum.amount || 0;
  const avgValue = successful._avg.amount || 0;
  const successRate = total > 0 ? Math.round((successCount / total) * 100) : 0;

  return { total, successCount, revenue, avgValue, successRate };
}

function fillDateGaps(
  data: { date: string; revenue: number; transactions: number }[],
  startDate: Date,
  endDate: Date
): { date: string; revenue: number; transactions: number }[] {
  const map = new Map(data.map((d) => [d.date, d]));
  const result = [];
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);

  while (cursor <= endDate) {
    const key = cursor.toISOString().split('T')[0];
    result.push(map.get(key) || { date: key, revenue: 0, transactions: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
