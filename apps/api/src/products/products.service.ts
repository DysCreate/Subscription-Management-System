import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginated, resolvePagination, type Paginated } from '@subloop/shared';
import { AuditService } from '../common/audit/audit.service';
import { rethrowPrismaError } from '../common/prisma/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProductDto,
  ProductVariantDto,
  UpdateProductDto,
} from './dto/product.dto';

type ProductWithVariants = Prisma.ProductGetPayload<{ include: { variants: true } }>;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(query: {
    page?: string;
    limit?: string;
    search?: string;
    isActive?: string;
  }): Promise<Paginated<ProductWithVariants>> {
    const pagination = resolvePagination(query);
    const search = query.search?.trim();

    const where: Prisma.ProductWhereInput = {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { notes: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive === 'true' }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: { variants: { orderBy: { attribute: 'asc' } } },
        orderBy: { name: 'asc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.product.count({ where }),
    ]);

    return paginated(data, pagination, total);
  }

  async findOne(id: string): Promise<ProductWithVariants> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { variants: { orderBy: { attribute: 'asc' } } },
    });
    if (!product) throw new NotFoundException('Product not found.');
    return product;
  }

  async create(dto: CreateProductDto, actorId: string): Promise<ProductWithVariants> {
    try {
      const product = await this.prisma.product.create({
        data: {
          name: dto.name.trim(),
          type: dto.type,
          salesPrice: new Prisma.Decimal(dto.salesPrice),
          costPrice: new Prisma.Decimal(dto.costPrice),
          notes: dto.notes ?? null,
          isActive: dto.isActive ?? true,
          variants: dto.variants?.length
            ? {
                create: dto.variants.map((variant) => ({
                  attribute: variant.attribute.trim(),
                  value: variant.value.trim(),
                  extraPrice: new Prisma.Decimal(variant.extraPrice),
                })),
              }
            : undefined,
        },
        include: { variants: true },
      });

      await this.auditService.record({
        actorId,
        entity: 'product',
        entityId: product.id,
        action: 'PRODUCT_CREATED',
        diff: { name: product.name, salesPrice: product.salesPrice.toString() },
      });
      return product;
    } catch (error) {
      rethrowPrismaError(error, 'A variant with this attribute/value already exists for the product.');
    }
  }

  async update(id: string, dto: UpdateProductDto, actorId: string): Promise<ProductWithVariants> {
    await this.findOne(id);
    try {
      const { variants, ...rest } = dto;
      const product = await this.prisma.product.update({
        where: { id },
        data: {
          name: rest.name,
          type: rest.type,
          salesPrice:
            rest.salesPrice === undefined ? undefined : new Prisma.Decimal(rest.salesPrice),
          costPrice: rest.costPrice === undefined ? undefined : new Prisma.Decimal(rest.costPrice),
          notes: rest.notes,
          isActive: rest.isActive,
        },
        include: { variants: true },
      });

      await this.auditService.record({
        actorId,
        entity: 'product',
        entityId: id,
        action: 'PRODUCT_UPDATED',
        diff: { changes: { ...rest, variants: variants?.length ?? 0 } },
      });
      return product;
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  async addVariant(productId: string, dto: ProductVariantDto, actorId: string) {
    await this.findOne(productId);
    try {
      const variant = await this.prisma.productVariant.create({
        data: {
          productId,
          attribute: dto.attribute.trim(),
          value: dto.value.trim(),
          extraPrice: new Prisma.Decimal(dto.extraPrice),
        },
      });
      await this.auditService.record({
        actorId,
        entity: 'product_variant',
        entityId: variant.id,
        action: 'VARIANT_CREATED',
        diff: { productId, attribute: variant.attribute, value: variant.value },
      });
      return variant;
    } catch (error) {
      rethrowPrismaError(error, 'This attribute/value already exists for the product.');
    }
  }

  async updateVariant(
    productId: string,
    variantId: string,
    dto: Partial<ProductVariantDto>,
    actorId: string,
  ) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });
    if (!variant) throw new NotFoundException('Variant not found for this product.');

    try {
      const updated = await this.prisma.productVariant.update({
        where: { id: variantId },
        data: {
          attribute: dto.attribute?.trim(),
          value: dto.value?.trim(),
          extraPrice:
            dto.extraPrice === undefined ? undefined : new Prisma.Decimal(dto.extraPrice),
        },
      });
      await this.auditService.record({
        actorId,
        entity: 'product_variant',
        entityId: variantId,
        action: 'VARIANT_UPDATED',
        diff: { changes: { ...dto } },
      });
      return updated;
    } catch (error) {
      rethrowPrismaError(error, 'This attribute/value already exists for the product.');
    }
  }

  async removeVariant(productId: string, variantId: string, actorId: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });
    if (!variant) throw new NotFoundException('Variant not found for this product.');

    const usedInLines = await this.prisma.subscriptionLine.count({ where: { variantId } });
    if (usedInLines > 0) {
      throw new BadRequestException(
        'This variant is used by existing subscriptions and cannot be removed.',
      );
    }

    await this.prisma.productVariant.delete({ where: { id: variantId } });
    await this.auditService.record({
      actorId,
      entity: 'product_variant',
      entityId: variantId,
      action: 'VARIANT_DELETED',
      diff: { productId, attribute: variant.attribute, value: variant.value },
    });
    return { success: true as const };
  }

  /** Products referenced by subscriptions are archived, never hard-deleted. */
  async deactivate(id: string, actorId: string) {
    const product = await this.findOne(id);
    await this.prisma.product.update({ where: { id }, data: { isActive: false } });
    await this.auditService.record({
      actorId,
      entity: 'product',
      entityId: id,
      action: 'PRODUCT_DEACTIVATED',
      diff: { name: product.name },
    });
    return { success: true as const };
  }
}
