import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function contextFor(user?: { id: string; email: string; role: string; customerId: string | null }) {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
      getResponse: () => ({}),
    }),
  } as unknown as ExecutionContext;
}

function guardWith(requiredRoles?: string[]): RolesGuard {
  const reflector = {
    getAllAndOverride: () => requiredRoles,
  } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  const admin = { id: 'a', email: 'admin@subloop.local', role: 'ADMIN', customerId: null };
  const staff = { id: 's', email: 'staff@subloop.local', role: 'STAFF', customerId: null };
  const customer = { id: 'c', email: 'customer@subloop.local', role: 'CUSTOMER', customerId: 'cust-1' };

  it('allows routes without @Roles metadata', () => {
    expect(guardWith(undefined).canActivate(contextFor(customer))).toBe(true);
  });

  it('lets an admin reach admin-only routes', () => {
    expect(guardWith(['ADMIN']).canActivate(contextFor(admin))).toBe(true);
  });

  it('blocks staff from admin-only routes (no staff creation, no discount config)', () => {
    expect(() => guardWith(['ADMIN']).canActivate(contextFor(staff))).toThrow(ForbiddenException);
  });

  it('blocks customers from staff/admin routes', () => {
    expect(() => guardWith(['ADMIN', 'STAFF']).canActivate(contextFor(customer))).toThrow(
      ForbiddenException,
    );
  });

  it('blocks anonymous requests', () => {
    expect(() => guardWith(['ADMIN']).canActivate(contextFor(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
