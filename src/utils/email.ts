import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'Payment Platform <noreply@payplatform.com>',
    ...options,
  });
};

export const sendTeamInviteEmail = async (email: string, inviterName: string): Promise<void> => {
  await sendEmail({
    to: email,
    subject: 'You have been invited to join the team',
    html: `
      <h2>Team Invitation</h2>
      <p>${inviterName} has invited you to join their payment platform team.</p>
      <p>Click the link below to accept the invitation:</p>
      <a href="${process.env.FRONTEND_URL}/accept-invite?email=${email}">Accept Invitation</a>
    `,
  });
};

export const sendContactAckEmail = async (name: string, email: string): Promise<void> => {
  await sendEmail({
    to: email,
    subject: 'We received your message',
    html: `
      <h2>Thanks for reaching out, ${name}!</h2>
      <p>We've received your message and will get back to you within 24 hours.</p>
    `,
  });
};
