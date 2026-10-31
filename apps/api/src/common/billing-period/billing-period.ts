import type { BillingPeriod } from '@subloop/shared';

/**
 * Calendar-aware billing period helpers.
 *
 * `BILLING_PERIOD_DAYS` in @subloop/shared is a coarse approximation (a month
 * is not always 30 days). Invoicing and renewals must use real calendar
 * arithmetic, including month-end clamping:
 *
 *   Jan 31 + 1 month  -> Feb 28/29
 *   Feb 28 + 1 month  -> Mar 31  (month-end stays month-end)
 *   Feb 29 + 1 year   -> Feb 28
 */
export function startOfUtcDay(date: Date): Date {
  const copy = new Date(date.getTime());
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

export function addUtcDays(date: Date, days: number): Date {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function daysInUtcMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function addUtcMonths(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const sourceIsMonthEnd = day === daysInUtcMonth(year, month);

  const target = new Date(Date.UTC(year, month + months, 1));
  const targetYear = target.getUTCFullYear();
  const targetMonth = target.getUTCMonth();
  const targetLastDay = daysInUtcMonth(targetYear, targetMonth);
  const targetDay = sourceIsMonthEnd ? targetLastDay : Math.min(day, targetLastDay);

  return new Date(Date.UTC(targetYear, targetMonth, targetDay));
}

function addUtcYears(date: Date, years: number): Date {
  return addUtcMonths(date, years * 12);
}

/** Advances a date by exactly one plan period. */
export function addBillingPeriod(date: Date, period: BillingPeriod): Date {
  const base = startOfUtcDay(date);
  switch (period) {
    case 'DAILY':
      return addUtcDays(base, 1);
    case 'WEEKLY':
      return addUtcDays(base, 7);
    case 'MONTHLY':
      return addUtcMonths(base, 1);
    case 'YEARLY':
      return addUtcYears(base, 1);
    default:
      return base;
  }
}

/**
 * Inclusive period end for an invoice. The next billing date is exclusive, so
 * a monthly period starting Jan 31 ends on Feb 27 and the next one starts Feb
 * 28.
 */
export function billingPeriodEnd(start: Date, period: BillingPeriod): Date {
  return addUtcDays(addBillingPeriod(start, period), -1);
}

/**
 * Parses free-text payment terms such as "Net 30", "30 days", "NET_15" or
 * "due on receipt". Unknown text falls back to the configured default.
 */
export function parsePaymentTermsDays(
  terms: string | null | undefined,
  fallbackDays = 0,
): number {
  if (!terms) return fallbackDays;
  const normalized = terms.trim().toLowerCase();
  if (!normalized) return fallbackDays;
  if (/receipt|immediate|on delivery|due now/.test(normalized)) return 0;

  const match = /(\d+)/.exec(normalized);
  if (!match) return fallbackDays;
  const days = Number(match[1]);
  return Number.isFinite(days) && days >= 0 ? days : fallbackDays;
}
