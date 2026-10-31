import { PASSWORD_MIN_LENGTH } from './constants';

export interface PasswordValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Single source of truth for the password policy, reused by the API
 * (class-validator) and the web app (client-side form validation).
 *
 * Rule from the brief: more than 8 characters, at least one uppercase,
 * one lowercase and one special character.
 */
export function validatePassword(password: string | null | undefined): PasswordValidation {
  const value = password ?? '';
  const errors: string[] = [];

  if (value.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be longer than 8 characters (at least ${PASSWORD_MIN_LENGTH}).`);
  }
  if (!/[A-Z]/.test(value)) {
    errors.push('Password must contain an uppercase letter.');
  }
  if (!/[a-z]/.test(value)) {
    errors.push('Password must contain a lowercase letter.');
  }
  if (!/[^A-Za-z0-9]/.test(value)) {
    errors.push('Password must contain a special character.');
  }

  return { valid: errors.length === 0, errors };
}

/** Human readable one-liner for UI hints and API error messages. */
export function passwordPolicyMessage(): string {
  return 'Password must be longer than 8 characters and include an uppercase letter, a lowercase letter and a special character.';
}
