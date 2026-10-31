import { ConflictException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

const logger = new Logger('PrismaErrors');

/**
 * Turns Prisma's known request errors into meaningful HTTP errors:
 * unique violations become 409 and missing records stay 404s at the call site.
 */
export function rethrowPrismaError(error: unknown, uniqueMessage?: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target)
        ? (error.meta?.target as string[]).join(', ')
        : String(error.meta?.target ?? 'value');
      throw new ConflictException(uniqueMessage ?? `A record with this ${target} already exists.`);
    }
    if (error.code === 'P2025') {
      throw new ConflictException('The referenced record no longer exists.');
    }
  }
  if (error instanceof Error) {
    logger.error(error.message, error.stack);
  }
  throw error;
}
