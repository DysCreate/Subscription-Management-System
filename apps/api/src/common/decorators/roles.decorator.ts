import { SetMetadata } from '@nestjs/common';
import { Role } from '@subloop/shared';

export const ROLES_KEY = 'roles';

/** Declares which roles may reach a route. Enforced by RolesGuard. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
