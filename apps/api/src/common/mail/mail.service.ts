import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { env, envNumber } from '../../config/env';

/**
 * Thin email wrapper. Locally this talks to Mailpit (SMTP on 1025, web UI on
 * 8025). Settings suggest Resend in production, which works through the same
 * SMTP transport. Mail failures are logged but never break the API call that
 * triggered them — a password reset request must stay generic and successful.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;

    this.transporter = createTransport({
      host: env('SMTP_HOST', 'localhost'),
      port: envNumber('SMTP_PORT', 1025),
      secure: env('SMTP_SECURE', 'false') === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? '' }
        : undefined,
    });
    return this.transporter;
  }

  async send(options: { to: string; subject: string; text: string; html?: string }): Promise<void> {
    try {
      await this.getTransporter().sendMail({
        from: env('MAIL_FROM', 'SubLoop <no-reply@subloop.local>'),
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
    } catch (error) {
      this.logger.warn(`Email to ${options.to} failed: ${(error as Error).message}`);
    }
  }

  async sendPasswordReset(to: string, resetUrl: string, expiresInMinutes: number): Promise<void> {
    await this.send({
      to,
      subject: 'Reset your SubLoop password',
      text: [
        'We received a request to reset your SubLoop password.',
        '',
        `Reset link (valid for ${expiresInMinutes} minutes): ${resetUrl}`,
        '',
        'If you did not request this, you can safely ignore this email.',
      ].join('\n'),
      html: `
        <p>We received a request to reset your SubLoop password.</p>
        <p><a href="${resetUrl}">Reset your password</a></p>
        <p>This link is valid for ${expiresInMinutes} minutes and can be used once.</p>
        <p>If you did not request this, you can safely ignore this email.</p>
      `,
    });
  }
}
