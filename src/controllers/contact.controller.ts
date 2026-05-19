import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import { sendEmail, sendContactAckEmail } from '../utils/email';
import prisma from '../config/prisma';

export const submitContact = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      sendError(res, 'All fields are required');
      return;
    }

    // Save to DB
    const contact = await prisma.contactMessage.create({
      data: { name, email, subject, message },
    });

    // Send internal notification email (non-blocking)
    if (process.env.SMTP_USER) {
      sendEmail({
        to: process.env.SMTP_USER,
        subject: `[Contact] ${subject}`,
        html: `<h3>New contact message from ${name} (${email})</h3><p>${message}</p>`,
      }).catch(console.error);

      // Send acknowledgment to user
      sendContactAckEmail(name, email).catch(console.error);
    }

    sendSuccess(res, { id: contact.id }, 201, 'Message received. We\'ll get back to you shortly.');
  } catch (err) { next(err); }
};
