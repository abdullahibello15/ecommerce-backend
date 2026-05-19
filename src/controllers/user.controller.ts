import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response';
import prisma from '../config/prisma';

export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { firstName, lastName, phone } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { firstName, lastName, phone },
      select: { id: true, email: true, firstName: true, lastName: true, phone: true, avatarUrl: true },
    });
    sendSuccess(res, user, 200, 'Profile updated');
  } catch (err) { next(err); }
};

export const changePassword = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) { sendError(res, 'User not found', 404); return; }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) { sendError(res, 'Current password is incorrect', 401); return; }

    if (newPassword.length < 8) { sendError(res, 'Password must be at least 8 characters'); return; }

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.user!.userId }, data: { password: hashed } });

    // Invalidate all refresh tokens on password change
    await prisma.refreshToken.deleteMany({ where: { userId: req.user!.userId } });

    sendSuccess(res, null, 200, 'Password changed successfully. Please log in again.');
  } catch (err) { next(err); }
};

export const updateAvatar = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { avatarUrl } = req.body; // Accept URL (e.g. from Cloudinary upload)
    if (!avatarUrl) { sendError(res, 'avatarUrl is required'); return; }

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { avatarUrl },
      select: { id: true, avatarUrl: true },
    });
    sendSuccess(res, user, 200, 'Avatar updated');
  } catch (err) { next(err); }
};
