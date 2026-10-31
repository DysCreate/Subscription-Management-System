import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../common/mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InvoiceEmailService {
  private readonly logger = new Logger(InvoiceEmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /** Emails a confirmed invoice. Missing/cancelled invoices are ignored. */
  async sendForInvoice(invoiceId: string): Promise<void> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
        subscription: { include: { plan: true } },
        lines: true,
      },
    });

    if (!invoice || invoice.status === 'CANCELLED' || invoice.status === 'DRAFT') {
      this.logger.debug(`No email sent for invoice ${invoiceId} (missing, draft or cancelled).`);
      return;
    }

    const lineText = invoice.lines
      .map(
        (line) =>
          `  ${line.description}  ${line.quantity} x ${line.unitPrice.toString()} = ${line.amount.toString()}`,
      )
      .join('\n');

    const text = [
      `Hello ${invoice.customer.name},`,
      '',
      `Your invoice ${invoice.number} for ${invoice.subscription.plan.name} is ready.`,
      `Period: ${invoice.periodStart.toISOString().slice(0, 10)} to ${invoice.periodEnd
        .toISOString()
        .slice(0, 10)}`,
      `Due date: ${invoice.dueDate.toISOString().slice(0, 10)}`,
      '',
      lineText,
      '',
      `Subtotal: ${invoice.subtotal.toString()}`,
      `Discount: ${invoice.discountTotal.toString()}`,
      `Tax: ${invoice.taxTotal.toString()}`,
      `Total: ${invoice.total.toString()}`,
      '',
      'Thank you for your business.',
    ].join('\n');

    await this.mail.send({
      to: invoice.customer.email,
      subject: `Invoice ${invoice.number} from SubLoop`,
      text,
      html: `<pre style="font-family: ui-monospace, monospace">${escapeHtml(text)}</pre>`,
    });
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
