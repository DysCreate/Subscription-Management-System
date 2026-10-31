import { Prisma } from '@prisma/client';
import { decimal, round2, sumDecimals, type DecimalInput } from '../common/money/money';

export interface TaxRule {
  type: 'PERCENT' | 'FIXED';
  rate: DecimalInput;
}

/**
 * Tax engine.
 *
 * Every amount is computed with Prisma.Decimal (Postgres numeric semantics) and
 * rounded half-up to 2 decimal places at the line boundary. Fixed taxes are a
 * flat amount per line; percentage taxes are a percentage of the line amount.
 */
export function calculateTax(amount: DecimalInput, tax: TaxRule | null | undefined): Prisma.Decimal {
  if (!tax) return new Prisma.Decimal(0);

  const base = decimal(amount);
  const rate = decimal(tax.rate);

  if (tax.type === 'PERCENT') {
    return round2(base.mul(rate).div(100));
  }
  return round2(rate);
}

export interface TaxableLine {
  amount: DecimalInput;
  tax?: TaxRule | null;
}

export interface TaxedLine {
  taxAmount: Prisma.Decimal;
  grossAmount: Prisma.Decimal;
}

export function calculateLineTax(line: TaxableLine): TaxedLine {
  const grossAmount = round2(decimal(line.amount));
  return {
    grossAmount,
    taxAmount: calculateTax(grossAmount, line.tax),
  };
}

export function calculateTaxTotal(lines: TaxableLine[]): Prisma.Decimal {
  return sumDecimals(lines.map((line) => calculateTax(line.amount, line.tax)));
}
