import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { sendSuccess } from '../utils/response';
import prisma from '../config/prisma';

export const getBillingPlans = async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const plans = await prisma.billingPlan.findMany({ where: { isActive: true }, orderBy: { price: 'asc' } });
    sendSuccess(res, plans);
  } catch (err) { next(err); }
};

export const getCurrentPlan = async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: { status: 'ACTIVE' },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    sendSuccess(res, subscription || null);
  } catch (err) { next(err); }
};

export const upgradePlan = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { planId } = req.body;
    const plan = await prisma.billingPlan.findUnique({ where: { id: planId } });
    if (!plan) { res.status(404).json({ success: false, error: 'Plan not found' }); return; }

    // Cancel existing subscription
    await prisma.subscription.updateMany({ where: { status: 'ACTIVE' }, data: { status: 'CANCELLED', endDate: new Date() } });

    // Create new subscription
    const subscription = await prisma.subscription.create({
      data: { planId, status: 'ACTIVE' },
      include: { plan: true },
    });

    sendSuccess(res, subscription, 201, `Upgraded to ${plan.displayName}`);
  } catch (err) { next(err); }
};
