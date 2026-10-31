import { Prisma } from '@prisma/client';

/**
 * Money helpers. All monetary values are stored as Postgres `numeric` and
 * handled with Prisma.Decimal so we never accumulate IEEE-754 float error.
 */
export type DecimalInput = Prisma.Decimal | number | string;

export function decimal(value: DecimalInput): Prisma.Decimal {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

export function sumDecimals(values: DecimalInput[]): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>((total, value) => total.add(decimal(value)), new Prisma.Decimal(0));
}

export function round2(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}
