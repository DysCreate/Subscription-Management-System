import { BadRequestException } from '@nestjs/common';
import { validatePassword } from '@subloop/shared';
import { AuthService } from './auth.service';

describe('password policy', () => {
  it('accepts a password longer than 8 chars with upper, lower and special', () => {
    expect(validatePassword('Str0ng!pass').valid).toBe(true);
  });

  it('rejects exactly 8 characters', () => {
    const result = validatePassword('Str0ng!p');
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/longer than 8/);
  });

  it('requires an uppercase letter', () => {
    expect(validatePassword('str0ng!pass').valid).toBe(false);
  });

  it('requires a lowercase letter', () => {
    expect(validatePassword('STR0NG!PASS').valid).toBe(false);
  });

  it('requires a special character', () => {
    expect(validatePassword('Str0ngpass1').valid).toBe(false);
  });

  it('reports every failing rule at once', () => {
    expect(validatePassword('short').errors).toHaveLength(3);
  });

  it('AuthService.assertPasswordPolicy throws a 400 for weak passwords', () => {
    expect(() => AuthService.assertPasswordPolicy('weak')).toThrow(BadRequestException);
    expect(() => AuthService.assertPasswordPolicy('Str0ng!pass')).not.toThrow();
  });

  it('never returns password hashes in the auth user projection', () => {
    const user = AuthService.toAuthUser({
      id: 'u1',
      email: 'staff@subloop.local',
      role: 'STAFF',
      customerId: null,
      isActive: true,
    });
    expect(user).toEqual({
      id: 'u1',
      email: 'staff@subloop.local',
      role: 'STAFF',
      customerId: null,
      isActive: true,
    });
    expect(Object.keys(user)).not.toContain('passwordHash');
  });
});
