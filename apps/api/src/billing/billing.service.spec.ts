import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from './billing.service';
import { InMemoryPrisma, type SeedData } from './testing/in-memory-prisma';

const AS_OF = new Date('2026-01-31T00:00:00.000Z');

describe('BillingService', () => {
  let prisma: InMemoryPrisma;
  let service: BillingService;

  beforeEach(() => {
    prisma = new InMemoryPrisma();
    service = new BillingService(prisma as unknown as PrismaService);
  });

  it('creates a confirmed invoice with variant pricing, tax and discounts', async () => {
    seed(prisma, {
      products: [{ id: 'product-1', name: 'Hosting' }],
      variants: [
        {
          id: 'variant-1',
          productId: 'product-1',
          attribute: 'Tier',
          value: 'Pro',
          extraPrice: '2.50',
        },
      ],
      taxes: [{ id: 'tax-1', name: 'GST', type: 'PERCENT', rate: '18' }],
      subscriptions: [
        {
          id: 'sub-1',
          customerId: 'customer-1',
          planId: 'plan-monthly',
          nextBillingDate: new Date('2026-01-01T00:00:00.000Z'),
          paymentTerms: 'Net 30',
          lines: [
            {
              productId: 'product-1',
              variantId: 'variant-1',
              quantity: 3,
              unitPrice: '10.00',
              taxId: 'tax-1',
            },
          ],
        },
      ],
      discounts: [
        {
          id: 'discount-1',
          name: 'Launch',
          type: 'PERCENT',
          value: '10',
          scope: 'SUBSCRIPTION',
        },
      ],
    });

    const run = await service.runBilling(new Date('2026-01-15T00:00:00.000Z'), 'test');

    expect(run).toMatchObject({ created: 1, skipped: 0, failed: 0, triggeredBy: 'test' });
    expect(prisma.invoices).toHaveLength(1);

    const invoice = prisma.invoices[0];
    expect(invoice.number).toBe('INV-000001');
    expect(invoice.status).toBe('CONFIRMED');
    expect(invoice.issuedAt).toBeInstanceOf(Date);
    expect(day(invoice.periodStart)).toBe('2026-01-01');
    expect(day(invoice.periodEnd)).toBe('2026-01-31');
    expect(day(invoice.dueDate)).toBe('2026-02-14');
    expect(decimal(invoice.subtotal)).toBe('37.50');
    expect(decimal(invoice.taxTotal)).toBe('6.75');
    expect(decimal(invoice.discountTotal)).toBe('3.75');
    expect(decimal(invoice.total)).toBe('40.50');

    expect(prisma.invoiceLines).toHaveLength(1);
    expect(prisma.invoiceLines[0]).toMatchObject({ quantity: 3, qty: 3 });
    expect(decimal(prisma.invoiceLines[0].unitPrice)).toBe('12.50');
    expect(decimal(prisma.invoiceLines[0].amount)).toBe('37.50');
    expect(decimal(prisma.invoiceLines[0].taxAmount)).toBe('6.75');

    expect(prisma.invoiceDiscounts).toHaveLength(1);
    expect(decimal(prisma.invoiceDiscounts[0].amount)).toBe('3.75');
    expect(prisma.discounts[0].timesUsed).toBe(1);
    expect(day(prisma.subscriptions[0].nextBillingDate)).toBe('2026-02-01');
  });

  it('applies product discounts before subscription discounts and records both', async () => {
    seed(prisma, {
      products: [
        { id: 'product-1', name: 'Hosting' },
        { id: 'product-2', name: 'Support' },
      ],
      subscriptions: [
        {
          id: 'sub-1',
          customerId: 'customer-1',
          planId: 'plan-monthly',
          nextBillingDate: new Date('2026-01-01T00:00:00.000Z'),
          lines: [
            { productId: 'product-1', quantity: 1, unitPrice: '100.00' },
            { productId: 'product-2', quantity: 1, unitPrice: '50.00' },
          ],
        },
      ],
      discounts: [
        {
          id: 'product-discount',
          name: 'Hosting sale',
          type: 'FIXED',
          value: '20',
          scope: 'PRODUCT',
          productIds: ['product-1'],
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          id: 'subscription-discount',
          name: 'Loyalty',
          type: 'PERCENT',
          value: '10',
          scope: 'SUBSCRIPTION',
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
        },
      ],
    });

    await service.runBilling(new Date('2026-01-15T00:00:00.000Z'), 'test');

    const invoice = prisma.invoices[0];
    expect(decimal(invoice.subtotal)).toBe('150.00');
    expect(decimal(invoice.discountTotal)).toBe('33.00');
    expect(decimal(invoice.total)).toBe('117.00');
    expect(prisma.invoiceDiscounts.map((row) => decimal(row.amount))).toEqual(['20.00', '13.00']);
  });

  it('never lets the invoice total go negative', async () => {
    seed(prisma, {
      subscriptions: [
        {
          id: 'sub-1',
          customerId: 'customer-1',
          planId: 'plan-monthly',
          nextBillingDate: new Date('2026-01-01T00:00:00.000Z'),
          lines: [{ productId: 'product-1', quantity: 1, unitPrice: '30.00' }],
        },
      ],
      discounts: [
        {
          id: 'too-big',
          name: 'Too big',
          type: 'FIXED',
          value: '1000',
          scope: 'SUBSCRIPTION',
        },
      ],
    });

    await service.runBilling(new Date('2026-01-15T00:00:00.000Z'), 'test');

    expect(decimal(prisma.invoices[0].discountTotal)).toBe('30.00');
    expect(decimal(prisma.invoices[0].total)).toBe('0.00');
  });

  it('does not double-bill when the same run is executed twice', async () => {
    seed(prisma);

    const first = await service.runBilling(AS_OF, 'first');
    const second = await service.runBilling(AS_OF, 'second');

    expect(first).toMatchObject({ created: 1, skipped: 0, failed: 0 });
    expect(second).toMatchObject({ created: 0, skipped: 0, failed: 0 });
    expect(prisma.invoices).toHaveLength(1);
    expect(prisma.invoiceLines).toHaveLength(1);
  });

  it('is safe when two billing runs race for the same subscription', async () => {
    seed(prisma);

    const [first, second] = await Promise.all([
      service.runBilling(AS_OF, 'run-a'),
      service.runBilling(AS_OF, 'run-b'),
    ]);

    expect(first.created + second.created).toBe(1);
    expect(first.failed + second.failed).toBe(0);
    expect(prisma.invoices).toHaveLength(1);
    expect(prisma.billingRuns).toHaveLength(2);
    expect(prisma.billingRuns.every((run) => run.finishedAt instanceof Date)).toBe(true);
  });

  it('treats the unique invoice-period constraint as a skip, not a duplicate invoice', async () => {
    seed(prisma);
    prisma.invoices.push({
      id: 'existing-invoice',
      number: 'INV-EXISTING',
      subscriptionId: 'sub-1',
      customerId: 'customer-1',
      periodStart: new Date('2026-01-01T00:00:00.000Z'),
      periodEnd: new Date('2026-01-31T00:00:00.000Z'),
      status: 'CONFIRMED',
      subtotal: decimal('100.00'),
      discountTotal: decimal('0.00'),
      taxTotal: decimal('0.00'),
      total: decimal('100.00'),
      amountPaid: decimal('0.00'),
      dueDate: new Date('2026-01-31T00:00:00.000Z'),
      issuedAt: new Date('2026-01-01T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const run = await service.runBilling(AS_OF, 'test');

    expect(run).toMatchObject({ created: 0, skipped: 1, failed: 0 });
    expect(prisma.invoices).toHaveLength(1);
    expect(day(prisma.subscriptions[0].nextBillingDate)).toBe('2026-01-01');
  });

  it('never applies a limited discount more than its usage limit', async () => {
    seed(prisma, {
      subscriptions: [
        {
          id: 'sub-1',
          customerId: 'customer-1',
          planId: 'plan-monthly',
          nextBillingDate: new Date('2026-01-01T00:00:00.000Z'),
          lines: [{ productId: 'product-1', quantity: 1, unitPrice: '100.00' }],
        },
        {
          id: 'sub-2',
          customerId: 'customer-1',
          planId: 'plan-monthly',
          nextBillingDate: new Date('2026-01-01T00:00:00.000Z'),
          lines: [{ productId: 'product-1', quantity: 1, unitPrice: '100.00' }],
        },
      ],
      discounts: [
        {
          id: 'limited',
          name: 'First customer only',
          type: 'PERCENT',
          value: '10',
          scope: 'SUBSCRIPTION',
          usageLimit: 1,
        },
      ],
    });

    const run = await service.runBilling(AS_OF, 'test');

    expect(run).toMatchObject({ created: 2, skipped: 0, failed: 0 });
    expect(prisma.discounts[0].timesUsed).toBe(1);
    expect(prisma.invoiceDiscounts).toHaveLength(1);
    expect(prisma.invoices.map((invoice) => decimal(invoice.total))).toEqual(
      expect.arrayContaining(['90.00', '100.00']),
    );
  });

  it('excludes paused, expired and not-yet-due subscriptions', async () => {
    seed(prisma, {
      subscriptions: [
        {
          id: 'sub-active',
          customerId: 'customer-1',
          planId: 'plan-monthly',
          nextBillingDate: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          id: 'sub-paused',
          customerId: 'customer-1',
          planId: 'plan-monthly',
          status: 'PAUSED',
          nextBillingDate: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          id: 'sub-expired',
          customerId: 'customer-1',
          planId: 'plan-monthly',
          expiryDate: new Date('2026-01-30T00:00:00.000Z'),
          nextBillingDate: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          id: 'sub-future',
          customerId: 'customer-1',
          planId: 'plan-monthly',
          nextBillingDate: new Date('2026-02-01T00:00:00.000Z'),
        },
      ],
    });

    const run = await service.runBilling(AS_OF, 'test');

    expect(run).toMatchObject({ created: 1, skipped: 0, failed: 0 });
    expect(prisma.invoices).toHaveLength(1);
    expect(prisma.invoices[0].subscriptionId).toBe('sub-active');
  });

  it('rolls back a failed subscription, keeps it due, and continues with the batch', async () => {
    seed(prisma, {
      subscriptions: [
        {
          id: 'sub-good',
          customerId: 'customer-1',
          planId: 'plan-monthly',
          nextBillingDate: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          id: 'sub-bad',
          customerId: 'customer-1',
          planId: 'plan-monthly',
          nextBillingDate: new Date('2026-01-01T00:00:00.000Z'),
          lines: [],
        },
      ],
    });

    const first = await service.runBilling(AS_OF, 'test');

    expect(first).toMatchObject({ created: 1, skipped: 0, failed: 1 });
    expect(prisma.invoices).toHaveLength(1);
    expect(prisma.invoices[0].subscriptionId).toBe('sub-good');
    expect(day(prisma.subscriptions.find((row) => row.id === 'sub-bad')?.nextBillingDate)).toBe(
      '2026-01-01',
    );

    // Fix the broken subscription and retry: the failure did not consume its period.
    prisma.subscriptionLines.push({
      id: 'sub-bad-line',
      subscriptionId: 'sub-bad',
      productId: 'product-1',
      variantId: null,
      quantity: 1,
      unitPrice: decimal('25.00'),
      taxId: null,
      amount: decimal('25.00'),
    });

    const retry = await service.runBilling(AS_OF, 'retry');

    expect(retry).toMatchObject({ created: 1, skipped: 0, failed: 0 });
    expect(prisma.invoices).toHaveLength(2);
  });

  it('bills Jan 31 -> Feb 28 -> Mar 31 without drifting', async () => {
    seed(prisma, {
      subscriptions: [
        {
          id: 'sub-month-end',
          customerId: 'customer-1',
          planId: 'plan-monthly',
          nextBillingDate: new Date('2026-01-31T00:00:00.000Z'),
        },
      ],
    });

    await service.runBilling(new Date('2026-01-31T00:00:00.000Z'), 'jan');
    expect(day(prisma.invoices[0].periodStart)).toBe('2026-01-31');
    expect(day(prisma.invoices[0].periodEnd)).toBe('2026-02-27');
    expect(day(prisma.subscriptions[0].nextBillingDate)).toBe('2026-02-28');

    await service.runBilling(new Date('2026-02-28T00:00:00.000Z'), 'feb');
    expect(day(prisma.invoices[1].periodStart)).toBe('2026-02-28');
    expect(day(prisma.invoices[1].periodEnd)).toBe('2026-03-30');
    expect(day(prisma.subscriptions[0].nextBillingDate)).toBe('2026-03-31');

    await service.runBilling(new Date('2026-03-31T00:00:00.000Z'), 'mar');
    expect(day(prisma.invoices[2].periodStart)).toBe('2026-03-31');
    expect(day(prisma.invoices[2].periodEnd)).toBe('2026-04-29');
    expect(day(prisma.subscriptions[0].nextBillingDate)).toBe('2026-04-30');
  });

  it('uses cursor batches so a large backlog is never loaded all at once', async () => {
    const subscriptions = Array.from({ length: 205 }, (_, index) => ({
      id: `sub-${String(index).padStart(3, '0')}`,
      customerId: 'customer-1',
      planId: 'plan-monthly',
      nextBillingDate: new Date('2026-01-01T00:00:00.000Z'),
    }));
    seed(prisma, { subscriptions });

    const run = await service.runBilling(AS_OF, 'test');

    expect(run).toMatchObject({ created: 205, skipped: 0, failed: 0 });
    expect(prisma.invoices).toHaveLength(205);

    const subscriptionBatches = prisma.findManyCalls.filter((call) => call.model === 'subscription');
    expect(subscriptionBatches.length).toBeGreaterThanOrEqual(2);
    expect(Math.max(...subscriptionBatches.map((call) => call.returned))).toBe(200);
    expect(subscriptionBatches[0].args).toMatchObject({ take: 200 });
    expect(subscriptionBatches[1].args.cursor).toEqual({ id: 'sub-199' });
  });
});

function seed(prisma: InMemoryPrisma, overrides: Partial<SeedData> = {}): void {
  const subscriptions = (
    overrides.subscriptions ?? [
      {
        id: 'sub-1',
        customerId: 'customer-1',
        planId: 'plan-monthly',
        nextBillingDate: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]
  ).map((subscription) => ({
    ...subscription,
    lines:
      subscription.lines === undefined
        ? [{ productId: 'product-1', quantity: 1, unitPrice: '100.00' }]
        : subscription.lines,
  }));

  prisma.seed({
    customers: [{ id: 'customer-1', name: 'Acme', email: 'acme@example.com' }],
    products: [{ id: 'product-1', name: 'Hosting' }],
    plans: [
      {
        id: 'plan-monthly',
        name: 'Monthly plan',
        price: '100.00',
        billingPeriod: 'MONTHLY',
      },
    ],
    ...overrides,
    subscriptions,
  });
}

function decimal(value: Prisma.Decimal | number | string): string {
  return new Prisma.Decimal(value).toFixed(2);
}

function day(value: Date | null | undefined): string | undefined {
  return value?.toISOString().slice(0, 10);
}
