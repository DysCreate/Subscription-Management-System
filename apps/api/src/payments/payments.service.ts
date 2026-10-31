import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { paginated, resolvePagination } from '@subloop/shared';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { QueryPaymentDto } from './dto/query-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreatePaymentDto, actorId: string) {
    if (dto.amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0.');
    }

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: dto.invoiceId },
      });
      if (!invoice) throw new NotFoundException('Invoice not found.');
      if (invoice.status !== InvoiceStatus.CONFIRMED) {
        throw new BadRequestException('Only CONFIRMED invoices can accept payments.');
      }

      const balance = Number(invoice.total) - Number(invoice.amountPaid);
      if (Number(dto.amount) > balance + 1e-9) {
        throw new BadRequestException('Payment amount exceeds invoice balance.');
      }

      const payment = await tx.payment.create({
        data: {
          invoiceId: dto.invoiceId,
          method: dto.method,
          amount: new Prisma.Decimal(dto.amount),
          paidOn: new Date(dto.paidOn),
          note: dto.note,
          recordedById: actorId,
        },
      });

      const newAmountPaid = Number(invoice.amountPaid) + Number(dto.amount);
      const isFullyPaid = newAmountPaid >= Number(invoice.total) - 1e-9;

      const updatedInvoice = await tx.invoice.update({
        where: { id: dto.invoiceId },
        data: {
          amountPaid: new Prisma.Decimal(newAmountPaid.toFixed(2)),
          status: isFullyPaid ? InvoiceStatus.PAID : InvoiceStatus.CONFIRMED,
        },
      });

      await this.auditService.record({
        actorId,
        entity: 'payment',
        entityId: payment.id,
        action: 'PAYMENT_RECORDED',
        diff: {
          invoiceId: dto.invoiceId,
          amount: dto.amount,
          method: dto.method,
          invoiceStatus: updatedInvoice.status,
        },
      });

      return { payment, invoice: updatedInvoice };
    });
  }

  async findAll(query: QueryPaymentDto & { actorId?: string; actorRole?: string; customerId?: string }) {
    const pagination = resolvePagination({ page: query.page, limit: query.limit });
    const where: Prisma.PaymentWhereInput = {};

    if (query.method) {
      where.method = query.method;
    }
    if (query.invoiceId) {
      where.invoiceId = query.invoiceId;
    }
    if (query.from || query.to) {
      where.paidOn = {};
      if (query.from) where.paidOn.gte = new Date(query.from);
      if (query.to) where.paidOn.lte = new Date(query.to);
    }

    if (query.customerId) {
      where.invoice = { customerId: query.customerId };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: { invoice: { include: { customer: true } }, recordedBy: true },
        orderBy: { paidOn: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return paginated(data, pagination, total);
  }
}
