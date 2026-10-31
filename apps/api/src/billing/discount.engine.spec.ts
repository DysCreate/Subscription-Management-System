import { Prisma } from '@prisma/client';
import {
  allocateDiscount,
  computeDiscountAmount,
  createEvaluationLines,
  remainingSubtotal,
  selectApplicableDiscounts,
  type DiscountRule,
} from './discount.engine';

describe('discount engine', () => {
  const asOf = new Date('2026-01-31T00:00:00.000Z');

  it('applies PRODUCT discounts before SUBSCRIPTION discounts', () => {
    const product = rule({
      id: 'product',
      scope: 'PRODUCT',
      type: 'FIXED',
      value: '20',
      products: [{ productId: 'p1' }],
    });
    const subscription = rule({
      id: 'subscription',
      scope: 'SUBSCRIPTION',
      type: 'PERCENT',
      value: '10',
    });

    const selected = selectApplicableDiscounts(
      [subscription, product],
      createEvaluationLines([
        { productId: 'p1', quantity: 1, amount: '100' },
        { productId: 'p2', quantity: 1, amount: '50' },
      ]),
      asOf,
    );

    expect(selected.map((discount) => discount.id)).toEqual(['product', 'subscription']);
  });

  it('only lets a product discount touch its matching lines', () => {
    const lines = createEvaluationLines([
      { productId: 'p1', quantity: 1, amount: '100' },
      { productId: 'p2', quantity: 1, amount: '50' },
    ]);
    const discount = rule({
      id: 'product',
      scope: 'PRODUCT',
      type: 'PERCENT',
      value: '10',
      products: [{ productId: 'p1' }],
    });

    const amount = computeDiscountAmount(discount, lines);
    allocateDiscount(discount, lines, amount);

    expect(amount.toFixed(2)).toBe('10.00');
    expect(lines[0].remaining.toFixed(2)).toBe('90.00');
    expect(lines[1].remaining.toFixed(2)).toBe('50.00');
    expect(remainingSubtotal(lines).toFixed(2)).toBe('140.00');
  });

  it('applies a subscription discount to what remains after line discounts', () => {
    const lines = createEvaluationLines([
      { productId: 'p1', quantity: 1, amount: '100' },
      { productId: 'p2', quantity: 1, amount: '50' },
    ]);
    const product = rule({
      id: 'product',
      scope: 'PRODUCT',
      type: 'FIXED',
      value: '20',
      products: [{ productId: 'p1' }],
    });
    const subscription = rule({
      id: 'subscription',
      scope: 'SUBSCRIPTION',
      type: 'PERCENT',
      value: '10',
    });

    allocateDiscount(product, lines, computeDiscountAmount(product, lines));
    const subscriptionAmount = computeDiscountAmount(subscription, lines);
    allocateDiscount(subscription, lines, subscriptionAmount);

    expect(subscriptionAmount.toFixed(2)).toBe('13.00');
    expect(remainingSubtotal(lines).toFixed(2)).toBe('117.00');
  });

  it('never discounts below zero when stacked discounts exceed the subtotal', () => {
    const lines = createEvaluationLines([{ productId: 'p1', quantity: 1, amount: '100' }]);
    const first = rule({ id: 'first', type: 'FIXED', value: '80' });
    const second = rule({ id: 'second', type: 'FIXED', value: '80' });

    allocateDiscount(first, lines, computeDiscountAmount(first, lines));
    const secondAmount = computeDiscountAmount(second, lines);
    allocateDiscount(second, lines, secondAmount);

    expect(secondAmount.toFixed(2)).toBe('20.00');
    expect(remainingSubtotal(lines).toFixed(2)).toBe('0.00');
  });

  it('enforces minimum purchase, minimum quantity and the date window', () => {
    const lines = createEvaluationLines([{ productId: 'p1', quantity: 2, amount: '99.99' }]);

    expect(
      selectApplicableDiscounts([rule({ minPurchase: '100' })], lines, asOf),
    ).toHaveLength(0);
    expect(
      selectApplicableDiscounts([rule({ minPurchase: '99.99' })], lines, asOf),
    ).toHaveLength(1);
    expect(selectApplicableDiscounts([rule({ minQuantity: 3 })], lines, asOf)).toHaveLength(0);
    expect(
      selectApplicableDiscounts(
        [rule({ startDate: new Date('2026-02-01T00:00:00.000Z') })],
        lines,
        asOf,
      ),
    ).toHaveLength(0);
    expect(
      selectApplicableDiscounts(
        [rule({ endDate: new Date('2026-01-30T00:00:00.000Z') })],
        lines,
        asOf,
      ),
    ).toHaveLength(0);
  });

  it('excludes exhausted and inactive discounts', () => {
    const lines = createEvaluationLines([{ productId: 'p1', quantity: 1, amount: '100' }]);

    expect(
      selectApplicableDiscounts([rule({ usageLimit: 1, timesUsed: 1 })], lines, asOf),
    ).toHaveLength(0);
    expect(
      selectApplicableDiscounts([rule({ isActive: false })], lines, asOf),
    ).toHaveLength(0);
  });

  it('caps a fixed discount at the eligible amount', () => {
    const lines = createEvaluationLines([{ productId: 'p1', quantity: 1, amount: '30' }]);
    const discount = rule({ type: 'FIXED', value: '50' });

    expect(computeDiscountAmount(discount, lines).toFixed(2)).toBe('30.00');
  });
});

function rule(overrides: Partial<DiscountRule> = {}): DiscountRule {
  return {
    id: 'discount',
    type: 'PERCENT',
    value: new Prisma.Decimal(10),
    minPurchase: null,
    minQuantity: null,
    startDate: null,
    endDate: null,
    usageLimit: null,
    timesUsed: 0,
    scope: 'SUBSCRIPTION',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    products: [],
    ...overrides,
  };
}
