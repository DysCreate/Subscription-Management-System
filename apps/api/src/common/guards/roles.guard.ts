import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@subloop/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { RequestWithUser } from './jwt-auth.guard';

/**
 * Enforces @Roles(...) metadata. Runs after JwtAuthGuard, which is what puts
 * the authenticated user on the request.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Authentication required.');
    }
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('You do not have permission to perform this action.');
    }
    return true;
  }
}
