import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginated, resolvePagination, type Paginated } from '@subloop/shared';
import { AuditService } from '../common/audit/audit.service';
import { rethrowPrismaError } from '../common/prisma/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(query: {
    page?: string;
    limit?: string;
    search?: string;
    isActive?: string;
  }): Promise<Paginated<Prisma.CustomerGetPayload<{ include: { _count: { select: { subscriptions: true } } } }>>> {
    const pagination = resolvePagination(query);
    const search = query.search?.trim();

    const where: Prisma.CustomerWhereInput = {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive === 'true' }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        include: { _count: { select: { subscriptions: true } } },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return paginated(data, pagination, total);
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        _count: { select: { subscriptions: true, invoices: true } },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found.');
    return customer;
  }

  async create(dto: CreateCustomerDto, actorId: string) {
    try {
      const customer = await this.prisma.customer.create({
        data: {
          name: dto.name.trim(),
          email: dto.email.trim().toLowerCase(),
          phone: dto.phone ?? null,
          billingAddress: dto.billingAddress ?? null,
          taxId: dto.taxId ?? null,
        },
      });
      await this.auditService.record({
        actorId,
        entity: 'customer',
        entityId: customer.id,
        action: 'CUSTOMER_CREATED',
        diff: { name: customer.name, email: customer.email },
      });
      return customer;
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  async update(id: string, dto: UpdateCustomerDto, actorId: string) {
    await this.findOne(id);
    try {
      const customer = await this.prisma.customer.update({
        where: { id },
        data: {
          name: dto.name,
          email: dto.email ? dto.email.trim().toLowerCase() : undefined,
          phone: dto.phone,
          billingAddress: dto.billingAddress,
          taxId: dto.taxId,
          isActive: dto.isActive,
        },
      });
      await this.auditService.record({
        actorId,
        entity: 'customer',
        entityId: id,
        action: 'CUSTOMER_UPDATED',
        diff: { changes: { ...dto } },
      });
      return customer;
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  /**
   * Customers are never hard-deleted: invoices and history must survive.
   * Deleting deactivates the record and its logins (architecture.md §3).
   */
  async deactivate(id: string, actorId: string) {
    const customer = await this.findOne(id);
    await this.prisma.$transaction([
      this.prisma.customer.update({ where: { id }, data: { isActive: false } }),
      this.prisma.user.updateMany({ where: { customerId: id }, data: { isActive: false, refreshTokenHash: null } }),
    ]);
    await this.auditService.record({
      actorId,
      entity: 'customer',
      entityId: id,
      action: 'CUSTOMER_DEACTIVATED',
      diff: { name: customer.name },
    });
    return { success: true as const };
  }
}
