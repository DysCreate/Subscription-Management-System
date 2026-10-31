import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Loads the first .env found (repo root, then apps/api) without overwriting
 * variables already provided by the shell or the platform.
 */
const candidates = [
  join(process.cwd(), '.env'),
  join(process.cwd(), '.env.local'),
  join(process.cwd(), '..', '..', '.env'),
];

for (const path of candidates) {
  if (existsSync(path)) {
    loadDotenv({ path });
    break;
  }
}
