import { Prisma } from '@prisma/client';
import { calculateLineTax, calculateTax, calculateTaxTotal } from './tax.engine';

describe('tax engine', () => {
  it('rounds percentage tax half-up at the line boundary', () => {
    // 99.99 * 10% = 9.999 -> 10.00
    expect(calculateTax('99.99', { type: 'PERCENT', rate: '10' }).toFixed(2)).toBe('10.00');
    // 10.01 * 18% = 1.8018 -> 1.80
    expect(calculateTax('10.01', { type: 'PERCENT', rate: '18' }).toFixed(2)).toBe('1.80');
  });

  it('uses decimal arithmetic instead of floating point', () => {
    const amount = calculateTax('0.10', { type: 'PERCENT', rate: '10' });
    expect(amount).toBeInstanceOf(Prisma.Decimal);
    expect(amount.toFixed(2)).toBe('0.01');
  });

  it('treats fixed tax as a flat amount per line', () => {
    expect(calculateTax('250.00', { type: 'FIXED', rate: '12.345' }).toFixed(2)).toBe('12.35');
  });

  it('returns zero when no tax is configured', () => {
    expect(calculateTax('100', null).toFixed(2)).toBe('0.00');
  });

  it('computes gross and tax together for a line', () => {
    const result = calculateLineTax({
      amount: '33.333',
      tax: { type: 'PERCENT', rate: '18' },
    });
    expect(result.grossAmount.toFixed(2)).toBe('33.33');
    expect(result.taxAmount.toFixed(2)).toBe('6.00');
  });

  it('sums line taxes without accumulating float error', () => {
    const total = calculateTaxTotal([
      { amount: '0.10', tax: { type: 'PERCENT', rate: '10' } },
      { amount: '0.10', tax: { type: 'PERCENT', rate: '10' } },
      { amount: '0.10', tax: { type: 'PERCENT', rate: '10' } },
    ]);
    expect(total.toFixed(2)).toBe('0.03');
  });
});
