/**
 * Small typed wrapper around process.env so every module reads configuration
 * the same way and missing secrets fail fast at boot.
 */
export function env(name: string, fallback?: string): string {
  const value = process.env[name];
  if (value !== undefined && value !== '') return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable: ${name}`);
}

export function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function envList(name: string, fallback: string[] = []): string[] {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isProduction(): boolean {
  return env('NODE_ENV', 'development') === 'production';
}

/** Converts `15m` / `7d` / `3600s` into seconds (JWT `expiresIn` friendly). */
export function durationToSeconds(value: string): number {
  const match = /^(\d+)\s*([smhd])?$/.exec(value.trim());
  if (!match) return 900;
  const amount = Number(match[1]);
  switch (match[2]) {
    case 'd':
      return amount * 86_400;
    case 'h':
      return amount * 3_600;
    case 'm':
      return amount * 60;
    default:
      return amount;
  }
}
