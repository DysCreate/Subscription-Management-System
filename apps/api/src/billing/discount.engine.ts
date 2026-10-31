import { Prisma } from '@prisma/client';
import { startOfUtcDay } from '../common/billing-period/billing-period';
import { decimal, round2, sumDecimals, type DecimalInput } from '../common/money/money';

export interface DiscountRule {
  id: string;
  type: 'FIXED' | 'PERCENT';
  value: DecimalInput;
  minPurchase: DecimalInput | null;
  minQuantity: number | null;
  startDate: Date | null;
  endDate: Date | null;
  usageLimit: number | null;
  timesUsed: number;
  scope: 'PRODUCT' | 'SUBSCRIPTION';
  isActive: boolean;
  createdAt: Date;
  products: Array<{ productId: string }>;
}

export interface DiscountLine {
  productId: string;
  quantity: number;
  amount: DecimalInput;
}

/** Mutable per-invoice view used while discounts are allocated in order. */
export interface DiscountEvaluationLine {
  productId: string;
  quantity: number;
  amount: Prisma.Decimal;
  remaining: Prisma.Decimal;
}

export function createEvaluationLines(lines: DiscountLine[]): DiscountEvaluationLine[] {
  return lines.map((line) => {
    const amount = round2(decimal(line.amount));
    return {
      productId: line.productId,
      quantity: line.quantity,
      amount,
      remaining: amount,
    };
  });
}

export function remainingSubtotal(lines: DiscountEvaluationLine[]): Prisma.Decimal {
  return sumDecimals(lines.map((line) => line.remaining));
}

function isWithinWindow(discount: DiscountRule, asOfDate: Date): boolean {
  const asOf = startOfUtcDay(asOfDate);
  if (discount.startDate && startOfUtcDay(discount.startDate) > asOf) return false;
  if (discount.endDate && startOfUtcDay(discount.endDate) < asOf) return false;
  return true;
}

function matchesProduct(discount: DiscountRule, lines: DiscountEvaluationLine[]): boolean {
  if (discount.scope === 'SUBSCRIPTION') return true;
  const productIds = new Set(discount.products.map((link) => link.productId));
  return lines.some((line) => productIds.has(line.productId) && line.amount.gt(0));
}

/**
 * Returns the discounts that may apply to this invoice, in the order required
 * by architecture.md §7: line/product discounts first, then whole-subscription
 * discounts. The atomic usage-limit gate happens later, in BillingService, so
 * a discount that loses the race is simply skipped.
 */
export function selectApplicableDiscounts(
  discounts: DiscountRule[],
  lines: DiscountEvaluationLine[],
  asOfDate: Date,
): DiscountRule[] {
  const subtotal = sumDecimals(lines.map((line) => line.amount));
  const totalQuantity = lines.reduce((total, line) => total + line.quantity, 0);

  return discounts
    .filter((discount) => {
      if (!discount.isActive) return false;
      if (!isWithinWindow(discount, asOfDate)) return false;
      if (discount.minPurchase !== null && subtotal.lt(decimal(discount.minPurchase))) return false;
      if (discount.minQuantity !== null && totalQuantity < discount.minQuantity) return false;
      if (discount.usageLimit !== null && discount.timesUsed >= discount.usageLimit) return false;
      return matchesProduct(discount, lines);
    })
    .sort((left, right) => {
      if (left.scope !== right.scope) return left.scope === 'PRODUCT' ? -1 : 1;
      const byCreated = left.createdAt.getTime() - right.createdAt.getTime();
      if (byCreated !== 0) return byCreated;
      return left.id.localeCompare(right.id);
    });
}

function eligibleAmount(discount: DiscountRule, lines: DiscountEvaluationLine[]): Prisma.Decimal {
  if (discount.scope === 'SUBSCRIPTION') {
    return remainingSubtotal(lines);
  }
  const productIds = new Set(discount.products.map((link) => link.productId));
  return sumDecimals(
    lines.filter((line) => productIds.has(line.productId)).map((line) => line.remaining),
  );
}

/** Computes the discount amount against what is still un-discounted. */
export function computeDiscountAmount(
  discount: DiscountRule,
  lines: DiscountEvaluationLine[],
): Prisma.Decimal {
  const eligible = eligibleAmount(discount, lines);
  if (eligible.lte(0)) return new Prisma.Decimal(0);

  const value = decimal(discount.value);
  const raw = discount.type === 'PERCENT' ? eligible.mul(value).div(100) : value;
  const rounded = round2(raw);

  if (rounded.lte(0)) return new Prisma.Decimal(0);
  return Prisma.Decimal.min(rounded, eligible);
}

/**
 * Allocates an accepted discount across the eligible lines so later discounts
 * see the reduced remaining amount. This is what guarantees the invoice total
 * can never go below zero.
 */
export function allocateDiscount(
  discount: DiscountRule,
  lines: DiscountEvaluationLine[],
  amount: DecimalInput,
): void {
  let left = decimal(amount);
  if (left.lte(0)) return;

  const productIds = new Set(discount.products.map((link) => link.productId));
  const targets =
    discount.scope === 'SUBSCRIPTION'
      ? lines
      : lines.filter((line) => productIds.has(line.productId));

  for (const line of targets) {
    if (left.lte(0)) break;
    if (line.remaining.lte(0)) continue;
    const take = Prisma.Decimal.min(line.remaining, left);
    line.remaining = line.remaining.sub(take);
    left = left.sub(take);
  }
}
