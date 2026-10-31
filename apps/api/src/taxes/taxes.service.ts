import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Tax } from '@prisma/client';
import { paginated, resolvePagination, type Paginated } from '@subloop/shared';
import { AuditService } from '../common/audit/audit.service';
import { rethrowPrismaError } from '../common/prisma/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaxDto, UpdateTaxDto } from './dto/tax.dto';

/** A percentage tax above 100% is almost certainly a typo. */
function assertRate(type: 'PERCENT' | 'FIXED', rate: number): void {
  if (type === 'PERCENT' && rate > 100) {
    throw new BadRequestException('A percentage tax rate cannot exceed 100.');
  }
}

@Injectable()
export class TaxesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(query: {
    page?: string;
    limit?: string;
    search?: string;
    isActive?: string;
  }): Promise<Paginated<Tax>> {
    const pagination = resolvePagination(query);
    const where: Prisma.TaxWhereInput = {
      ...(query.search ? { name: { contains: query.search.trim(), mode: 'insensitive' } } : {}),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive === 'true' }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.tax.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.tax.count({ where }),
    ]);

    return paginated(data, pagination, total);
  }

  async findOne(id: string) {
    const tax = await this.prisma.tax.findUnique({ where: { id } });
    if (!tax) throw new NotFoundException('Tax not found.');
    return tax;
  }

  async create(dto: CreateTaxDto, actorId: string) {
    assertRate(dto.type, dto.rate);
    try {
      const tax = await this.prisma.tax.create({
        data: {
          name: dto.name.trim(),
          type: dto.type,
          rate: new Prisma.Decimal(dto.rate),
          isActive: dto.isActive ?? true,
        },
      });
      await this.auditService.record({
        actorId,
        entity: 'tax',
        entityId: tax.id,
        action: 'TAX_CREATED',
        diff: { name: tax.name, type: tax.type, rate: tax.rate.toString() },
      });
      return tax;
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  async update(id: string, dto: UpdateTaxDto, actorId: string) {
    const existing = await this.findOne(id);
    assertRate(dto.type ?? existing.type, dto.rate ?? Number(existing.rate));

    try {
      const tax = await this.prisma.tax.update({
        where: { id },
        data: {
          name: dto.name,
          type: dto.type,
          rate: dto.rate === undefined ? undefined : new Prisma.Decimal(dto.rate),
          isActive: dto.isActive,
        },
      });
      await this.auditService.record({
        actorId,
        entity: 'tax',
        entityId: id,
        action: 'TAX_UPDATED',
        diff: { changes: { ...dto } },
      });
      return tax;
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  async deactivate(id: string, actorId: string) {
    const tax = await this.findOne(id);
    await this.prisma.tax.update({ where: { id }, data: { isActive: false } });
    await this.auditService.record({
      actorId,
      entity: 'tax',
      entityId: id,
      action: 'TAX_DEACTIVATED',
      diff: { name: tax.name },
    });
    return { success: true as const };
  }
}
