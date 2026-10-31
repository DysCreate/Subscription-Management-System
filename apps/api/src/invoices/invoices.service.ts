import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { paginated, resolvePagination } from '@subloop/shared';
import PDFDocument from 'pdfkit';
import { AuditService } from '../common/audit/audit.service';
import { MailService } from '../common/mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueryInvoiceDto } from './dto/query-invoice.dto';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly mailService: MailService,
  ) {}

  private async getInvoiceWithRelations(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        lines: true,
        discounts: { include: { discount: true } },
        payments: true,
        customer: true,
        subscription: true,
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found.');
    return invoice;
  }

  async findAll(query: QueryInvoiceDto & { actorId?: string; actorRole?: string; customerId?: string }) {
    const pagination = resolvePagination({ page: query.page, limit: query.limit });
    const where: Prisma.InvoiceWhereInput = {};

    if (query.customerId) {
      where.customerId = query.customerId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.subscriptionId) {
      where.subscriptionId = query.subscriptionId;
    }

    if (query.overdue === 'true') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      where.status = InvoiceStatus.CONFIRMED;
      where.dueDate = { lt: today };
    }

    if (query.from || query.to) {
      where.dueDate = {};
      if (query.from) where.dueDate.gte = new Date(query.from);
      if (query.to) where.dueDate.lte = new Date(query.to);
    }

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { number: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const orderBy: Prisma.InvoiceOrderByWithRelationInput = {};
    if (query.sortBy) {
      (orderBy as any)[query.sortBy] = query.sortOrder || 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include: { customer: true, subscription: true },
        orderBy,
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return paginated(data, pagination, total);
  }

  async findOne(id: string, viewer?: { role: string; customerId?: string | null }) {
    const invoice = await this.getInvoiceWithRelations(id);
    if (viewer?.role === 'CUSTOMER') {
      if (!viewer.customerId || invoice.customerId !== viewer.customerId) {
        throw new ForbiddenException('You do not have permission to view this invoice.');
      }
    }
    return invoice;
  }

  async confirm(id: string, actorId?: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found.');
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT invoices can be confirmed.');
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.CONFIRMED, issuedAt: new Date() },
    });

    await this.auditService.record({
      actorId: actorId ?? null,
      entity: 'invoice',
      entityId: id,
      action: 'INVOICE_CONFIRMED',
      diff: { from: invoice.status, to: updated.status },
    });

    return updated;
  }

  async cancel(id: string, actorId?: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id }, include: { payments: true } });
    if (!invoice) throw new NotFoundException('Invoice not found.');
    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Cannot cancel a PAID invoice.');
    }
    if (invoice.payments.length > 0) {
      throw new BadRequestException('Cannot cancel an invoice with payments.');
    }
    if (invoice.status !== InvoiceStatus.DRAFT && invoice.status !== InvoiceStatus.CONFIRMED) {
      throw new BadRequestException('Invoice cannot be cancelled in current status.');
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.CANCELLED },
    });

    await this.auditService.record({
      actorId: actorId ?? null,
      entity: 'invoice',
      entityId: id,
      action: 'INVOICE_CANCELLED',
      diff: { from: invoice.status, to: updated.status },
    });

    return updated;
  }

  async send(id: string, actorId?: string) {
    const invoice = await this.getInvoiceWithRelations(id);
    if (invoice.status !== InvoiceStatus.CONFIRMED) {
      throw new BadRequestException('Only CONFIRMED invoices can be sent.');
    }
    // stub the sender if none exists - just queue/email
    try {
      if (invoice.customer?.email) {
        await this.mailService.send({
          to: invoice.customer.email,
          subject: `Invoice ${invoice.number}`,
          text: `Your invoice ${invoice.number} is available. Total: ${invoice.total}. Due: ${invoice.dueDate.toISOString().split('T')[0]}`,
        });
      }
    } catch {
      // ignore
    }
    await this.auditService.record({
      actorId: actorId ?? null,
      entity: 'invoice',
      entityId: id,
      action: 'INVOICE_SENT',
    });
    return { success: true };
  }

  async generatePdf(id: string): Promise<Buffer> {
    const invoice = await this.getInvoiceWithRelations(id);
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const buffer = await new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.fontSize(20).text(`Invoice ${invoice.number}`, { align: 'left' });
      doc.moveDown();
      doc.fontSize(10).text(`Status: ${invoice.status}`);
      doc.text(`Customer: ${invoice.customer?.name || invoice.customerId}`);
      doc.text(`Period: ${invoice.periodStart.toISOString().split('T')[0]} to ${invoice.periodEnd.toISOString().split('T')[0]}`);
      doc.text(`Due Date: ${invoice.dueDate.toISOString().split('T')[0]}`);
      doc.moveDown();
      doc.text('Lines:');
      for (const line of invoice.lines) {
        doc.text(`- ${line.description} x${line.quantity || (line as any).qty} @ ${line.unitPrice} = ${line.amount}`);
      }
      doc.moveDown();
      doc.text(`Subtotal: ${invoice.subtotal}`);
      doc.text(`Discount: ${invoice.discountTotal}`);
      doc.text(`Tax: ${invoice.taxTotal}`);
      doc.text(`Total: ${invoice.total}`);
      doc.text(`Amount Paid: ${invoice.amountPaid}`);
      doc.text(`Balance: ${Number(invoice.total) - Number(invoice.amountPaid)}`);
      doc.end();
    });
    return buffer;
  }
}
