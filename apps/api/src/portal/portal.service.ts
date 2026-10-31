import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { paginated, resolvePagination } from '@subloop/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PortalService {
  constructor(private readonly prisma: PrismaService) {}

  async getSubscriptions(customerId: string | null | undefined) {
    if (!customerId) throw new ForbiddenException('Customer account required.');
    return this.prisma.subscription.findMany({
      where: { customerId },
      include: { plan: true, lines: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInvoices(
    customerId: string | null | undefined,
    query: { page?: number; limit?: number; status?: InvoiceStatus } = {},
  ) {
    if (!customerId) throw new ForbiddenException('Customer account required.');
    const pagination = resolvePagination({ page: query.page, limit: query.limit });
    const where: any = { customerId };
    if (query.status) where.status = query.status;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include: { subscription: true },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return paginated(data, pagination, total);
  }

  async getInvoice(id: string, customerId: string | null | undefined) {
    if (!customerId) throw new ForbiddenException('Customer account required.');
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        lines: true,
        discounts: { include: { discount: true } },
        payments: true,
        subscription: true,
        customer: true,
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found.');
    if (invoice.customerId !== customerId) {
      throw new ForbiddenException('You do not have permission to view this invoice.');
    }
    return invoice;
  }
}
