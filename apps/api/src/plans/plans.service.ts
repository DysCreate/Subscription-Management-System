import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Plan } from '@prisma/client';
import { paginated, resolvePagination, type BillingPeriod, type Paginated } from '@subloop/shared';
import { AuditService } from '../common/audit/audit.service';
import { rethrowPrismaError } from '../common/prisma/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';

function assertAvailabilityWindow(from?: Date | null, to?: Date | null): void {
  if (from && to && from.getTime() > to.getTime()) {
    throw new BadRequestException('availableFrom must be before availableTo.');
  }
}

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(query: {
    page?: string;
    limit?: string;
    search?: string;
    billingPeriod?: BillingPeriod;
    isActive?: string;
  }): Promise<Paginated<Plan>> {
    const pagination = resolvePagination(query);
    const where: Prisma.PlanWhereInput = {
      ...(query.search ? { name: { contains: query.search.trim(), mode: 'insensitive' } } : {}),
      ...(query.billingPeriod ? { billingPeriod: query.billingPeriod } : {}),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive === 'true' }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.plan.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.plan.count({ where }),
    ]);

    return paginated(data, pagination, total);
  }

  async findOne(id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found.');
    return plan;
  }

  async create(dto: CreatePlanDto, actorId: string) {
    const from = dto.availableFrom ? new Date(dto.availableFrom) : null;
    const to = dto.availableTo ? new Date(dto.availableTo) : null;
    assertAvailabilityWindow(from, to);

    try {
      const plan = await this.prisma.plan.create({
        data: {
          name: dto.name.trim(),
          price: new Prisma.Decimal(dto.price),
          billingPeriod: dto.billingPeriod,
          minQuantity: dto.minQuantity ?? 1,
          availableFrom: from,
          availableTo: to,
          autoClose: dto.autoClose ?? false,
          closable: dto.closable ?? true,
          pausable: dto.pausable ?? true,
          renewable: dto.renewable ?? true,
          isActive: dto.isActive ?? true,
        },
      });

      await this.auditService.record({
        actorId,
        entity: 'plan',
        entityId: plan.id,
        action: 'PLAN_CREATED',
        diff: {
          name: plan.name,
          price: plan.price.toString(),
          billingPeriod: plan.billingPeriod,
          flags: {
            autoClose: plan.autoClose,
            closable: plan.closable,
            pausable: plan.pausable,
            renewable: plan.renewable,
          },
        },
      });
      return plan;
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  async update(id: string, dto: UpdatePlanDto, actorId: string) {
    const existing = await this.findOne(id);

    const from = dto.availableFrom ? new Date(dto.availableFrom) : existing.availableFrom;
    const to = dto.availableTo ? new Date(dto.availableTo) : existing.availableTo;
    assertAvailabilityWindow(from, to);

    try {
      const plan = await this.prisma.plan.update({
        where: { id },
        data: {
          name: dto.name,
          price: dto.price === undefined ? undefined : new Prisma.Decimal(dto.price),
          billingPeriod: dto.billingPeriod,
          minQuantity: dto.minQuantity,
          availableFrom: dto.availableFrom ? new Date(dto.availableFrom) : undefined,
          availableTo: dto.availableTo ? new Date(dto.availableTo) : undefined,
          autoClose: dto.autoClose,
          closable: dto.closable,
          pausable: dto.pausable,
          renewable: dto.renewable,
          isActive: dto.isActive,
        },
      });

      await this.auditService.record({
        actorId,
        entity: 'plan',
        entityId: id,
        action: 'PLAN_UPDATED',
        diff: { changes: { ...dto } },
      });
      return plan;
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  async deactivate(id: string, actorId: string) {
    const plan = await this.findOne(id);
    await this.prisma.plan.update({ where: { id }, data: { isActive: false } });
    await this.auditService.record({
      actorId,
      entity: 'plan',
      entityId: id,
      action: 'PLAN_DEACTIVATED',
      diff: { name: plan.name },
    });
    return { success: true as const };
  }
}
