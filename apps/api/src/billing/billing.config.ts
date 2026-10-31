import type { InvoiceStatus } from '@prisma/client';
import { env, envNumber } from '../config/env';

/** Billing runs never load more than this many subscriptions at once. */
export const BILLING_BATCH_SIZE = 200;

/** Daily 00:30 (UTC) repeatable job, overridable for demos/tests. */
export function billingCronPattern(): string {
  return env('BILLING_CRON', '30 0 * * *');
}

export function billingCronTimezone(): string {
  return env('BILLING_CRON_TZ', 'UTC');
}

/** New invoices are CONFIRMED by default; set INVOICE_DEFAULT_STATUS=DRAFT to change that. */
export function defaultInvoiceStatus(): InvoiceStatus {
  const configured = process.env.INVOICE_DEFAULT_STATUS?.trim().toUpperCase();
  if (configured === 'DRAFT' || configured === 'CONFIRMED' || configured === 'PAID') {
    return configured;
  }
  return 'CONFIRMED';
}

/** Used when a subscription has no payment terms (0 = due on the billing date). */
export function defaultPaymentTermsDays(): number {
  return envNumber('DEFAULT_PAYMENT_TERMS_DAYS', 0);
}

export function redisUrl(): string {
  return env('REDIS_URL', 'redis://localhost:6379');
}
