import { Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import https from 'https';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response';
import prisma from '../config/prisma';

// ─── POST /api/payments/initialize ────────────────────────────────────────────
// Initializes a payment through the specified gateway.
// Used by both the Developer Playground and real checkout flows.
export const initializePayment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { amount, email, currency = 'NGN', gateway = 'paystack', metadata } = req.body;

    if (!amount || !email) {
      sendError(res, 'amount and email are required');
      return;
    }

    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      sendError(res, 'amount must be a positive number');
      return;
    }

    const reference = `TXN-${uuidv4().substring(0, 8).toUpperCase()}`;

    // Create a PENDING transaction record
    const transaction = await prisma.transaction.create({
      data: {
        reference,
        amount: Number(amount),
        currency,
        status: 'PENDING',
        gateway,
        customerEmail: email,
        metadata: metadata || null,
      },
    });

    // Try to call real gateway if keys exist
    let checkoutUrl: string | null = null;
    let gatewayRef: string | null = null;

    if (gateway === 'paystack' && process.env.PAYSTACK_SECRET_KEY) {
      const result = await callPaystack({ amount: Number(amount), email, reference, currency });
      if (result.success) {
        checkoutUrl = result.authorization_url;
        gatewayRef = result.access_code;
        await prisma.transaction.update({
          where: { reference },
          data: { gatewayRef },
        });
      }
    }

    sendSuccess(res, {
      reference,
      checkoutUrl,
      gatewayRef,
      amount: Number(amount),
      currency,
      gateway,
      status: 'PENDING',
      transaction,
    }, 201);
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/payments/verify/:reference ─────────────────────────────────────
export const verifyPayment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { reference } = req.params;

    const transaction = await prisma.transaction.findUnique({ where: { reference } });
    if (!transaction) { sendError(res, 'Transaction not found', 404); return; }

    // If Paystack, verify with their API
    if (transaction.gateway === 'paystack' && process.env.PAYSTACK_SECRET_KEY) {
      const verified = await verifyPaystack(reference);
      if (verified.status === 'success') {
        const updated = await prisma.transaction.update({
          where: { reference },
          data: { status: 'SUCCESS', paidAt: new Date() },
        });
        sendSuccess(res, updated);
        return;
      }
    }

    sendSuccess(res, transaction);
  } catch (err) {
    next(err);
  }
};

// ─── Paystack helpers ──────────────────────────────────────────────────────────

function callPaystack(params: {
  amount: number; email: string; reference: string; currency: string;
}): Promise<{ success: boolean; authorization_url: string; access_code: string }> {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      amount: params.amount * 100, // Paystack uses kobo
      email: params.email,
      reference: params.reference,
      currency: params.currency,
    });

    const options = {
      hostname: 'api.paystack.co',
      port: 443,
      path: '/transaction/initialize',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': body.length,
      },
    };

    const paystackReq = https.request(options, (paystackRes) => {
      let data = '';
      paystackRes.on('data', (chunk) => (data += chunk));
      paystackRes.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.status) {
            resolve({
              success: true,
              authorization_url: parsed.data.authorization_url,
              access_code: parsed.data.access_code,
            });
          } else {
            resolve({ success: false, authorization_url: '', access_code: '' });
          }
        } catch {
          resolve({ success: false, authorization_url: '', access_code: '' });
        }
      });
    });

    paystackReq.on('error', () => resolve({ success: false, authorization_url: '', access_code: '' }));
    paystackReq.write(body);
    paystackReq.end();
  });
}

function verifyPaystack(reference: string): Promise<{ status: string }> {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.paystack.co',
      path: `/transaction/verify/${reference}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    };

    const req = https.request(options, (paystackRes) => {
      let data = '';
      paystackRes.on('data', (c) => (data += c));
      paystackRes.on('end', () => {
        try {
          const p = JSON.parse(data);
          resolve({ status: p.data?.status || 'unknown' });
        } catch {
          resolve({ status: 'error' });
        }
      });
    });
    req.on('error', () => resolve({ status: 'error' }));
    req.end();
  });
}
