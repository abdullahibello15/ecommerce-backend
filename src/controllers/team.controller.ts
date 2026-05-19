import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { sendSuccess, sendError } from '../utils/response';
import { sendTeamInviteEmail } from '../utils/email';
import prisma from '../config/prisma';

export const getTeamMembers = async (_req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const members = await prisma.teamMember.findMany({
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });
    sendSuccess(res, members);
  } catch (err) { next(err); }
};

export const inviteTeamMember = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, role = 'VIEWER' } = req.body;
    if (!email) { sendError(res, 'Email is required'); return; }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });

    const member = await prisma.teamMember.create({
      data: {
        userId: existingUser?.id || req.user!.userId, // placeholder if user doesn't exist
        inviteEmail: email,
        role,
        status: 'PENDING',
        invitedBy: req.user!.userId,
      },
    });

    // Send invite email (non-blocking)
    const inviter = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { firstName: true, lastName: true } });
    sendTeamInviteEmail(email, `${inviter?.firstName} ${inviter?.lastName}`).catch(console.error);

    sendSuccess(res, member, 201, `Invitation sent to ${email}`);
  } catch (err) { next(err); }
};

export const updateTeamMemberRole = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { role } = req.body;
    const member = await prisma.teamMember.update({
      where: { id: req.params.id },
      data: { role },
    });
    sendSuccess(res, member, 200, 'Role updated');
  } catch (err) { next(err); }
};

export const removeTeamMember = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    await prisma.teamMember.delete({ where: { id: req.params.id } });
    sendSuccess(res, null, 200, 'Team member removed');
  } catch (err) { next(err); }
};
