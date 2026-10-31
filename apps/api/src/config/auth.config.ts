import { durationToSeconds, env } from './env';

export const REFRESH_COOKIE_NAME = 'subloop_refresh';

export const BCRYPT_ROUNDS = 10;

/** Access-token lifetime in seconds. */
export function accessTokenTtlSeconds(): number {
  return durationToSeconds(env('JWT_ACCESS_TTL', '15m'));
}

/** Refresh-token lifetime in seconds. */
export function refreshTokenTtlSeconds(): number {
  return durationToSeconds(env('JWT_REFRESH_TTL', '7d'));
}

export function accessTokenSecret(): string {
  return env('JWT_ACCESS_SECRET', 'dev-access-secret-change-me');
}

export function refreshTokenSecret(): string {
  return env('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me');
}

export function passwordResetTtlMinutes(): number {
  return Number(env('RESET_TOKEN_TTL_MINUTES', '30'));
}
