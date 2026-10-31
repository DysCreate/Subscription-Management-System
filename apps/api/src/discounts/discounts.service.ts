import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginated, resolvePagination, type Paginated } from '@subloop/shared';
import { AuditService } from '../common/audit/audit.service';
import { rethrowPrismaError } from '../common/prisma/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDiscountDto, UpdateDiscountDto } from './dto/discount.dto';

const DISCOUNT_INCLUDE = {
  products: { include: { product: { select: { id: true, name: true } } } },
} satisfies Prisma.DiscountInclude;

type DiscountWithProducts = Prisma.DiscountGetPayload<{ include: typeof DISCOUNT_INCLUDE }>;

/**
 * Discount *rules* are configured here. Evaluating them at invoice time and
 * incrementing `timesUsed` belongs to the billing engine workstream.
 */
@Injectable()
export class DiscountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private static validate(dto: Partial<CreateDiscountDto>): void {
    if (dto.type === 'PERCENT' && dto.value !== undefined && dto.value > 100) {
      throw new BadRequestException('A percentage discount cannot exceed 100.');
    }
    if (dto.startDate && dto.endDate && new Date(dto.startDate) > new Date(dto.endDate)) {
      throw new BadRequestException('startDate must be before endDate.');
    }
    if (dto.scope === 'PRODUCT' && (!dto.productIds || dto.productIds.length === 0)) {
      throw new BadRequestException('A product-scoped discount needs at least one product.');
    }
  }

  private async assertProducts(productIds: string[] | undefined): Promise<void> {
    if (!productIds?.length) return;
    const found = await this.prisma.product.count({ where: { id: { in: productIds } } });
    if (found !== productIds.length) {
      throw new BadRequestException('One or more products do not exist.');
    }
  }

  async list(query: {
    page?: string;
    limit?: string;
    search?: string;
    scope?: 'PRODUCT' | 'SUBSCRIPTION';
    isActive?: string;
  }): Promise<Paginated<DiscountWithProducts>> {
    const pagination = resolvePagination(query);
    const where: Prisma.DiscountWhereInput = {
      ...(query.search ? { name: { contains: query.search.trim(), mode: 'insensitive' } } : {}),
      ...(query.scope ? { scope: query.scope } : {}),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive === 'true' }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.discount.findMany({
        where,
        include: DISCOUNT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.discount.count({ where }),
    ]);

    return paginated(data, pagination, total);
  }

  async findOne(id: string): Promise<DiscountWithProducts> {
    const discount = await this.prisma.discount.findUnique({
      where: { id },
      include: DISCOUNT_INCLUDE,
    });
    if (!discount) throw new NotFoundException('Discount not found.');
    return discount;
  }

  async create(dto: CreateDiscountDto, actorId: string) {
    DiscountsService.validate(dto);
    await this.assertProducts(dto.productIds);

    try {
      const discount = await this.prisma.discount.create({
        data: {
          name: dto.name.trim(),
          type: dto.type,
          value: new Prisma.Decimal(dto.value),
          minPurchase:
            dto.minPurchase === undefined ? null : new Prisma.Decimal(dto.minPurchase),
          minQuantity: dto.minQuantity ?? null,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          usageLimit: dto.usageLimit ?? null,
          scope: dto.scope,
          isActive: dto.isActive ?? true,
          products: dto.productIds?.length
            ? { create: dto.productIds.map((productId) => ({ productId })) }
            : undefined,
        },
        include: DISCOUNT_INCLUDE,
      });

      await this.auditService.record({
        actorId,
        entity: 'discount',
        entityId: discount.id,
        action: 'DISCOUNT_CREATED',
        diff: {
          name: discount.name,
          type: discount.type,
          value: discount.value.toString(),
          scope: discount.scope,
        },
      });
      return discount;
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  async update(id: string, dto: UpdateDiscountDto, actorId: string) {
    const existing = await this.findOne(id);
    DiscountsService.validate({
      type: dto.type ?? existing.type,
      value: dto.value,
      startDate: dto.startDate ?? existing.startDate?.toISOString(),
      endDate: dto.endDate ?? existing.endDate?.toISOString(),
      scope: dto.scope ?? existing.scope,
      productIds: dto.productIds ?? existing.products.map((link) => link.productId),
    });
    await this.assertProducts(dto.productIds);

    try {
      const discount = await this.prisma.$transaction(async (tx) => {
        if (dto.productIds) {
          await tx.discountProduct.deleteMany({ where: { discountId: id } });
        }
        return tx.discount.update({
          where: { id },
          data: {
            name: dto.name,
            type: dto.type,
            value: dto.value === undefined ? undefined : new Prisma.Decimal(dto.value),
            minPurchase:
              dto.minPurchase === undefined ? undefined : new Prisma.Decimal(dto.minPurchase),
            minQuantity: dto.minQuantity,
            startDate: dto.startDate ? new Date(dto.startDate) : undefined,
            endDate: dto.endDate ? new Date(dto.endDate) : undefined,
            usageLimit: dto.usageLimit,
            scope: dto.scope,
            isActive: dto.isActive,
            products: dto.productIds?.length
              ? { create: dto.productIds.map((productId) => ({ productId })) }
              : undefined,
          },
          include: DISCOUNT_INCLUDE,
        });
      });

      await this.auditService.record({
        actorId,
        entity: 'discount',
        entityId: id,
        action: 'DISCOUNT_UPDATED',
        diff: { changes: { ...dto } },
      });
      return discount;
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  async deactivate(id: string, actorId: string) {
    const discount = await this.findOne(id);
    await this.prisma.discount.update({ where: { id }, data: { isActive: false } });
    await this.auditService.record({
      actorId,
      entity: 'discount',
      entityId: id,
      action: 'DISCOUNT_DEACTIVATED',
      diff: { name: discount.name },
    });
    return { success: true as const };
  }
}
