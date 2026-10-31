import type { Role } from '@subloop/shared';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  customerId: string | null;
}
