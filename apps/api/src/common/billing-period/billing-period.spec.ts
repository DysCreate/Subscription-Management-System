import {
  addBillingPeriod,
  addUtcDays,
  billingPeriodEnd,
  parsePaymentTermsDays,
  startOfUtcDay,
} from './billing-period';

describe('billing period arithmetic', () => {
  it('advances daily and weekly plans by exact calendar days', () => {
    expect(iso(addBillingPeriod(new Date('2026-01-31T18:45:00.000Z'), 'DAILY'))).toBe('2026-02-01');
    expect(iso(addBillingPeriod(new Date('2026-01-31T18:45:00.000Z'), 'WEEKLY'))).toBe('2026-02-07');
  });

  it('clamps Jan 31 to the last day of February', () => {
    expect(iso(addBillingPeriod(new Date('2026-01-31T00:00:00.000Z'), 'MONTHLY'))).toBe('2026-02-28');
    expect(iso(addBillingPeriod(new Date('2024-01-31T00:00:00.000Z'), 'MONTHLY'))).toBe('2024-02-29');
  });

  it('keeps a month-end anchor across short and long months', () => {
    const february = addBillingPeriod(new Date('2026-01-31T00:00:00.000Z'), 'MONTHLY');
    const march = addBillingPeriod(february, 'MONTHLY');
    const april = addBillingPeriod(march, 'MONTHLY');

    expect(iso(february)).toBe('2026-02-28');
    expect(iso(march)).toBe('2026-03-31');
    expect(iso(april)).toBe('2026-04-30');
  });

  it('does not turn an ordinary day into month-end', () => {
    expect(iso(addBillingPeriod(new Date('2026-01-15T00:00:00.000Z'), 'MONTHLY'))).toBe(
      '2026-02-15',
    );
    expect(iso(addBillingPeriod(new Date('2026-03-31T00:00:00.000Z'), 'MONTHLY'))).toBe(
      '2026-04-30',
    );
  });

  it('handles leap-day yearly renewals', () => {
    expect(iso(addBillingPeriod(new Date('2024-02-29T00:00:00.000Z'), 'YEARLY'))).toBe(
      '2025-02-28',
    );
  });

  it('returns an inclusive period end (next billing date minus one day)', () => {
    expect(iso(billingPeriodEnd(new Date('2026-01-31T00:00:00.000Z'), 'MONTHLY'))).toBe(
      '2026-02-27',
    );
    expect(iso(billingPeriodEnd(new Date('2026-01-01T00:00:00.000Z'), 'MONTHLY'))).toBe(
      '2026-01-31',
    );
  });

  it('normalises a timestamp to the start of the UTC day', () => {
    expect(startOfUtcDay(new Date('2026-02-03T23:59:59.999Z')).toISOString()).toBe(
      '2026-02-03T00:00:00.000Z',
    );
  });

  it('adds UTC days without local-time drift', () => {
    expect(iso(addUtcDays(new Date('2026-03-01T00:00:00.000Z'), 30))).toBe('2026-03-31');
  });

  it.each([
    ['Net 30', 30],
    ['NET_15', 15],
    ['45 days', 45],
    ['Due on receipt', 0],
    ['immediate', 0],
    ['', 7],
    [null, 7],
    ['whenever', 7],
  ])('parses payment terms %p as %p days', (terms, expected) => {
    expect(parsePaymentTermsDays(terms, 7)).toBe(expected);
  });
});

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}
