import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Writes to audit_log (architecture.md §9). Auditing must never break the
 * business action it describes, so failures are logged and swallowed.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(params: {
    actorId?: string | null;
    entity: string;
    entityId?: string | null;
    action: string;
    diff?: Prisma.InputJsonValue;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: params.actorId ?? null,
          entity: params.entity,
          entityId: params.entityId ?? null,
          action: params.action,
          diff: params.diff,
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to write audit entry: ${(error as Error).message}`);
    }
  }
}
