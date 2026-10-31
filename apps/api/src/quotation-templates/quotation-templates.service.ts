import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginated, resolvePagination, type Paginated } from '@subloop/shared';
import { AuditService } from '../common/audit/audit.service';
import { rethrowPrismaError } from '../common/prisma/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateQuotationTemplateDto,
  QuotationTemplateLineDto,
  UpdateQuotationTemplateDto,
} from './dto/quotation-template.dto';

const TEMPLATE_INCLUDE = {
  plan: true,
  lines: {
    include: {
      product: { select: { id: true, name: true, salesPrice: true, isActive: true } },
      variant: true,
    },
    orderBy: { id: 'asc' },
  },
} satisfies Prisma.QuotationTemplateInclude;

type TemplateWithLines = Prisma.QuotationTemplateGetPayload<{ include: typeof TEMPLATE_INCLUDE }>;

@Injectable()
export class QuotationTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /** Every line must point at an existing product and, if given, its variant. */
  private async assertLines(lines: QuotationTemplateLineDto[]): Promise<void> {
    const productIds = [...new Set(lines.map((line) => line.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { variants: true },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more lines reference a product that does not exist.');
    }

    const byId = new Map(products.map((product) => [product.id, product]));
    for (const line of lines) {
      if (!line.variantId) continue;
      const product = byId.get(line.productId);
      const ownsVariant = product?.variants.some((variant) => variant.id === line.variantId);
      if (!ownsVariant) {
        throw new BadRequestException('A line references a variant of a different product.');
      }
    }
  }

  async list(query: {
    page?: string;
    limit?: string;
    search?: string;
    planId?: string;
  }): Promise<Paginated<TemplateWithLines>> {
    const pagination = resolvePagination(query);
    const where: Prisma.QuotationTemplateWhereInput = {
      ...(query.search ? { name: { contains: query.search.trim(), mode: 'insensitive' } } : {}),
      ...(query.planId ? { planId: query.planId } : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.quotationTemplate.findMany({
        where,
        include: TEMPLATE_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.quotationTemplate.count({ where }),
    ]);

    return paginated(data, pagination, total);
  }

  async findOne(id: string): Promise<TemplateWithLines> {
    const template = await this.prisma.quotationTemplate.findUnique({
      where: { id },
      include: TEMPLATE_INCLUDE,
    });
    if (!template) throw new NotFoundException('Quotation template not found.');
    return template;
  }

  async create(dto: CreateQuotationTemplateDto, actorId: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
    if (!plan) throw new BadRequestException('The referenced plan does not exist.');
    await this.assertLines(dto.lines);

    try {
      const template = await this.prisma.quotationTemplate.create({
        data: {
          name: dto.name.trim(),
          planId: dto.planId,
          validityDays: dto.validityDays ?? 30,
          isActive: dto.isActive ?? true,
          lines: {
            create: dto.lines.map((line) => ({
              productId: line.productId,
              variantId: line.variantId ?? null,
              quantity: line.quantity,
            })),
          },
        },
        include: TEMPLATE_INCLUDE,
      });

      await this.auditService.record({
        actorId,
        entity: 'quotation_template',
        entityId: template.id,
        action: 'TEMPLATE_CREATED',
        diff: { name: template.name, planId: template.planId, lines: template.lines.length },
      });
      return template;
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  async update(id: string, dto: UpdateQuotationTemplateDto, actorId: string) {
    await this.findOne(id);
    if (dto.planId) {
      const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
      if (!plan) throw new BadRequestException('The referenced plan does not exist.');
    }
    if (dto.lines) await this.assertLines(dto.lines);

    try {
      const template = await this.prisma.$transaction(async (tx) => {
        if (dto.lines) {
          await tx.quotationTemplateLine.deleteMany({ where: { templateId: id } });
        }
        return tx.quotationTemplate.update({
          where: { id },
          data: {
            name: dto.name,
            planId: dto.planId,
            validityDays: dto.validityDays,
            isActive: dto.isActive,
            lines: dto.lines?.length
              ? {
                  create: dto.lines.map((line) => ({
                    productId: line.productId,
                    variantId: line.variantId ?? null,
                    quantity: line.quantity,
                  })),
                }
              : undefined,
          },
          include: TEMPLATE_INCLUDE,
        });
      });

      await this.auditService.record({
        actorId,
        entity: 'quotation_template',
        entityId: id,
        action: 'TEMPLATE_UPDATED',
        diff: {
          changes: {
            name: dto.name,
            planId: dto.planId,
            validityDays: dto.validityDays,
            isActive: dto.isActive,
            lines: dto.lines?.length ?? 0,
          },
        },
      });
      return template;
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  async deactivate(id: string, actorId: string) {
    const template = await this.findOne(id);
    await this.prisma.quotationTemplate.update({ where: { id }, data: { isActive: false } });
    await this.auditService.record({
      actorId,
      entity: 'quotation_template',
      entityId: id,
      action: 'TEMPLATE_DEACTIVATED',
      diff: { name: template.name },
    });
    return { success: true as const };
  }
}
