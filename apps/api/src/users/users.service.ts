import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginated, resolvePagination, type Paginated, type Role } from '@subloop/shared';
import { AuditService } from '../common/audit/audit.service';
import { rethrowPrismaError } from '../common/prisma/prisma-errors';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto, UpdateUserDto } from './dto/user.dto';

const USER_SELECT = {
  id: true,
  email: true,
  role: true,
  customerId: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type UserSummary = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /** Admin-only: create a staff (or additional admin) login. */
  async createStaff(dto: CreateStaffDto, actorId: string): Promise<UserSummary> {
    AuthService.assertPasswordPolicy(dto.password);

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    if (dto.customerId) {
      const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
      if (!customer) throw new NotFoundException('Customer not found.');
    }

    const passwordHash = await AuthService.hashPassword(dto.password);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash,
          role: (dto.role ?? 'STAFF') as Role,
          customerId: dto.customerId ?? null,
        },
        select: USER_SELECT,
      });

      await this.auditService.record({
        actorId,
        entity: 'user',
        entityId: user.id,
        action: 'STAFF_CREATED',
        diff: { email: user.email, role: user.role },
      });

      return user;
    } catch (error) {
      rethrowPrismaError(error, 'An account with this email already exists.');
    }
  }

  async list(query: {
    page?: string;
    limit?: string;
    role?: Role;
    search?: string;
  }): Promise<Paginated<UserSummary>> {
    const pagination = resolvePagination(query);
    const where: Prisma.UserWhereInput = {
      role: query.role,
      ...(query.search
        ? { email: { contains: query.search.trim().toLowerCase(), mode: 'insensitive' } }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.user.count({ where }),
    ]);

    return paginated(data, pagination, total);
  }

  async update(id: string, dto: UpdateUserDto, actorId: string): Promise<UserSummary> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found.');

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: {
          isActive: dto.isActive,
          role: dto.role,
          customerId: dto.customerId === undefined ? undefined : dto.customerId,
          // Deactivating a user also kills their refresh token immediately.
          ...(dto.isActive === false ? { refreshTokenHash: null } : {}),
        },
        select: USER_SELECT,
      });

      await this.auditService.record({
        actorId,
        entity: 'user',
        entityId: id,
        action: 'USER_UPDATED',
        diff: { changes: { ...dto } },
      });

      return user;
    } catch (error) {
      rethrowPrismaError(error);
    }
  }
}
