import { Prisma } from '@prisma/client';

type Row = Record<string, any>;
type DecimalValue = Prisma.Decimal | number | string;

export interface SeedSubscriptionLine {
  id?: string;
  productId: string;
  variantId?: string | null;
  quantity?: number;
  unitPrice: DecimalValue;
  taxId?: string | null;
  amount?: DecimalValue;
}

export interface SeedSubscription {
  id?: string;
  number?: string;
  customerId: string;
  planId: string;
  status?: string;
  startDate?: Date;
  expiryDate?: Date | null;
  nextBillingDate?: Date | null;
  paymentTerms?: string | null;
  lines?: SeedSubscriptionLine[];
}

export interface SeedData {
  customers?: Array<{ id?: string; name: string; email: string }>;
  products?: Array<{ id?: string; name: string }>;
  variants?: Array<{
    id?: string;
    productId: string;
    attribute: string;
    value: string;
    extraPrice?: DecimalValue;
  }>;
  taxes?: Array<{
    id?: string;
    name: string;
    type: 'PERCENT' | 'FIXED';
    rate: DecimalValue;
  }>;
  plans?: Array<{
    id?: string;
    name: string;
    price: DecimalValue;
    billingPeriod: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  }>;
  subscriptions?: SeedSubscription[];
  discounts?: Array<{
    id?: string;
    name: string;
    type: 'FIXED' | 'PERCENT';
    value: DecimalValue;
    minPurchase?: DecimalValue | null;
    minQuantity?: number | null;
    startDate?: Date | null;
    endDate?: Date | null;
    usageLimit?: number | null;
    timesUsed?: number;
    scope?: 'PRODUCT' | 'SUBSCRIPTION';
    isActive?: boolean;
    createdAt?: Date;
    productIds?: string[];
  }>;
}

interface FindManyCall {
  model: string;
  args: any;
  returned: number;
}

/**
 * Small in-memory stand-in for the Prisma models used by BillingService.
 *
 * Transactions are serialized and snapshot-rolled back, mirroring Postgres'
 * isolation for the billing test cases (concurrent runs, P2002 uniqueness and
 * rollback on failure). It is intentionally test-only and not a general Prisma
 * implementation.
 */
export class InMemoryPrisma {
  readonly customers: Row[] = [];
  readonly products: Row[] = [];
  readonly variants: Row[] = [];
  readonly taxes: Row[] = [];
  readonly plans: Row[] = [];
  readonly subscriptions: Row[] = [];
  readonly subscriptionLines: Row[] = [];
  readonly discounts: Row[] = [];
  readonly discountProducts: Row[] = [];
  readonly invoices: Row[] = [];
  readonly invoiceLines: Row[] = [];
  readonly invoiceDiscounts: Row[] = [];
  readonly billingRuns: Row[] = [];
  readonly findManyCalls: FindManyCall[] = [];

  private readonly counters = new Map<string, number>();
  private invoiceSequence = 0;
  private transactionTail: Promise<void> = Promise.resolve();

  seed(data: SeedData): void {
    for (const customer of data.customers ?? []) {
      this.customers.push({
        id: customer.id ?? this.nextId('customer'),
        name: customer.name,
        email: customer.email,
      });
    }

    for (const product of data.products ?? []) {
      this.products.push({
        id: product.id ?? this.nextId('product'),
        name: product.name,
      });
    }

    for (const variant of data.variants ?? []) {
      this.variants.push({
        id: variant.id ?? this.nextId('variant'),
        productId: variant.productId,
        attribute: variant.attribute,
        value: variant.value,
        extraPrice: decimal(variant.extraPrice ?? 0),
      });
    }

    for (const tax of data.taxes ?? []) {
      this.taxes.push({
        id: tax.id ?? this.nextId('tax'),
        name: tax.name,
        type: tax.type,
        rate: decimal(tax.rate),
        isActive: true,
      });
    }

    for (const plan of data.plans ?? []) {
      this.plans.push({
        id: plan.id ?? this.nextId('plan'),
        name: plan.name,
        price: decimal(plan.price),
        billingPeriod: plan.billingPeriod,
        isActive: true,
      });
    }

    for (const subscription of data.subscriptions ?? []) {
      const id = subscription.id ?? this.nextId('subscription');
      this.subscriptions.push({
        id,
        number: subscription.number ?? `SUB-${id}`,
        customerId: subscription.customerId,
        planId: subscription.planId,
        status: subscription.status ?? 'ACTIVE',
        startDate: subscription.startDate ?? new Date('2026-01-01T00:00:00.000Z'),
        expiryDate: subscription.expiryDate ?? null,
        nextBillingDate: subscription.nextBillingDate ?? null,
        quotationExpiresAt: null,
        paymentTerms: subscription.paymentTerms ?? null,
        pausedAt: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      for (const line of subscription.lines ?? []) {
        const quantity = line.quantity ?? 1;
        const unitPrice = decimal(line.unitPrice);
        this.subscriptionLines.push({
          id: line.id ?? this.nextId('subscription-line'),
          subscriptionId: id,
          productId: line.productId,
          variantId: line.variantId ?? null,
          quantity,
          unitPrice,
          taxId: line.taxId ?? null,
          amount: decimal(line.amount ?? unitPrice.mul(quantity)),
        });
      }
    }

    for (const discount of data.discounts ?? []) {
      const id = discount.id ?? this.nextId('discount');
      this.discounts.push({
        id,
        name: discount.name,
        type: discount.type,
        value: decimal(discount.value),
        minPurchase:
          discount.minPurchase === undefined || discount.minPurchase === null
            ? null
            : decimal(discount.minPurchase),
        minQuantity: discount.minQuantity ?? null,
        startDate: discount.startDate ?? null,
        endDate: discount.endDate ?? null,
        usageLimit: discount.usageLimit ?? null,
        timesUsed: discount.timesUsed ?? 0,
        scope: discount.scope ?? 'SUBSCRIPTION',
        isActive: discount.isActive ?? true,
        createdAt: discount.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      for (const productId of discount.productIds ?? []) {
        this.discountProducts.push({ discountId: id, productId });
      }
    }
  }

  async $transaction<T>(callback: ((tx: InMemoryPrisma) => Promise<T>) | Promise<T>[]): Promise<T> {
    if (Array.isArray(callback)) {
      return Promise.all(callback) as Promise<T>;
    }

    let release!: () => void;
    const previous = this.transactionTail;
    this.transactionTail = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    const snapshot = this.snapshot();
    try {
      return await callback(this);
    } catch (error) {
      this.restore(snapshot);
      throw error;
    } finally {
      release();
    }
  }

  async $queryRaw<T>(_strings: TemplateStringsArray, ..._values: unknown[]): Promise<T> {
    // Only the invoice sequence query is used by the billing service.
    return [{ nextval: BigInt(++this.invoiceSequence) }] as unknown as T;
  }

  readonly billingRun = {
    create: async ({ data }: { data: Row }) => {
      const row = {
        id: data.id ?? this.nextId('run'),
        startedAt: data.startedAt ?? new Date(),
        finishedAt: data.finishedAt ?? null,
        created: data.created ?? 0,
        skipped: data.skipped ?? 0,
        failed: data.failed ?? 0,
        triggeredBy: data.triggeredBy ?? null,
      };
      this.billingRuns.push(row);
      return { ...row };
    },
    findMany: async (args: any = {}) => {
      const rows = [...this.billingRuns]
        .sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime())
        .slice(0, args.take ?? undefined)
        .map((row) => ({ ...row }));
      this.recordFindMany('billingRun', args, rows.length);
      return rows;
    },
    findUnique: async ({ where }: { where: { id: string } }) => {
      const row = this.billingRuns.find((candidate) => candidate.id === where.id);
      return row ? { ...row } : null;
    },
    update: async ({ where, data }: { where: { id: string }; data: Row }) => {
      const index = this.billingRuns.findIndex((candidate) => candidate.id === where.id);
      if (index < 0) throw new Error(`BillingRun ${where.id} not found`);
      this.billingRuns[index] = { ...this.billingRuns[index], ...data };
      return { ...this.billingRuns[index] };
    },
  };

  readonly subscription = {
    findMany: async (args: any = {}) => {
      let rows = this.subscriptions.filter((row) => this.matchesSubscriptionWhere(row, args.where));
      rows = rows.sort((left, right) => left.id.localeCompare(right.id));

      if (args.cursor?.id) {
        const cursorIndex = rows.findIndex((row) => row.id === args.cursor.id);
        rows = rows.slice(cursorIndex + (args.skip ?? 1));
      }

      rows = rows.slice(0, args.take ?? undefined);
      const result = rows.map((row) => {
        if (args.select) {
          return Object.fromEntries(
            Object.entries(args.select)
              .filter(([, selected]) => selected)
              .map(([key]) => [key, row[key]]),
          );
        }
        return { ...row };
      });
      this.recordFindMany('subscription', args, result.length);
      return result;
    },
    findUnique: async ({ where, include }: { where: { id: string }; include?: any }) => {
      const row = this.subscriptions.find((candidate) => candidate.id === where.id);
      if (!row) return null;
      return this.withSubscriptionInclude(row, include);
    },
    update: async ({ where, data }: { where: { id: string }; data: Row }) => {
      const index = this.subscriptions.findIndex((candidate) => candidate.id === where.id);
      if (index < 0) throw new Error(`Subscription ${where.id} not found`);
      this.subscriptions[index] = {
        ...this.subscriptions[index],
        ...data,
        updatedAt: new Date(),
      };
      return { ...this.subscriptions[index] };
    },
  };

  readonly discount = {
    findMany: async (args: any = {}) => {
      const rows = this.discounts
        .filter((row) => (args.where?.isActive === undefined ? true : row.isActive === args.where.isActive))
        .map((row) => ({
          ...row,
          products: this.discountProducts
            .filter((link) => link.discountId === row.id)
            .map((link) => ({ productId: link.productId })),
        }));
      this.recordFindMany('discount', args, rows.length);
      return rows;
    },
    updateMany: async ({ where, data }: { where: Row; data: Row }) => {
      const rows = this.discounts.filter((row) => this.matchesDiscountWhere(row, where));
      for (const row of rows) {
        if (data.timesUsed?.increment !== undefined) {
          row.timesUsed += data.timesUsed.increment;
        }
      }
      return { count: rows.length };
    },
  };

  readonly invoice = {
    create: async ({ data }: { data: Row }) => {
      const duplicate = this.invoices.find(
        (row) =>
          row.subscriptionId === data.subscriptionId &&
          sameDate(row.periodStart, data.periodStart) &&
          sameDate(row.periodEnd, data.periodEnd),
      );
      if (duplicate) {
        throw { code: 'P2002', meta: { target: ['subscription_id', 'period_start', 'period_end'] } };
      }
      if (this.invoices.some((row) => row.number === data.number)) {
        throw { code: 'P2002', meta: { target: ['number'] } };
      }

      const { lines, discounts, ...invoiceData } = data;
      const invoice = {
        id: this.nextId('invoice'),
        ...invoiceData,
        amountPaid: decimal(0),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.invoices.push(invoice);

      for (const line of lines?.create ?? []) {
        this.invoiceLines.push({
          id: this.nextId('invoice-line'),
          invoiceId: invoice.id,
          ...line,
        });
      }

      for (const discount of discounts?.create ?? []) {
        this.invoiceDiscounts.push({
          id: this.nextId('invoice-discount'),
          invoiceId: invoice.id,
          discountId: discount.discount.connect.id,
          amount: discount.amount,
        });
      }

      return { ...invoice };
    },
    findMany: async (args: any = {}) => {
      const rows = this.invoices
        .filter((row) => {
          if (args.where?.status?.in && !args.where.status.in.includes(row.status)) return false;
          if (args.where?.createdAt?.gte && row.createdAt < args.where.createdAt.gte) return false;
          return true;
        })
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
        .slice(0, args.take ?? undefined)
        .map((row) => ({ ...row }));
      this.recordFindMany('invoice', args, rows.length);
      return rows;
    },
    findUnique: async ({ where }: { where: { id: string } }) => {
      const row = this.invoices.find((candidate) => candidate.id === where.id);
      return row ? { ...row } : null;
    },
  };

  private withSubscriptionInclude(row: Row, include: any): Row {
    const result: Row = { ...row };
    if (include?.plan) {
      result.plan = this.plans.find((plan) => plan.id === row.planId) ?? null;
    }
    if (include?.lines) {
      result.lines = this.subscriptionLines
        .filter((line) => line.subscriptionId === row.id)
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((line) => {
          const included: Row = { ...line };
          if (include.lines.include?.variant) {
            included.variant =
              this.variants.find((variant) => variant.id === line.variantId) ?? null;
          }
          if (include.lines.include?.tax) {
            included.tax = this.taxes.find((tax) => tax.id === line.taxId) ?? null;
          }
          if (include.lines.include?.product) {
            const product = this.products.find((candidate) => candidate.id === line.productId);
            included.product = product ? { id: product.id, name: product.name } : null;
          }
          return included;
        });
    }
    return result;
  }

  private matchesSubscriptionWhere(row: Row, where: any): boolean {
    if (!where) return true;
    if (where.status !== undefined && row.status !== where.status) return false;
    if (where.nextBillingDate?.lte !== undefined) {
      if (!row.nextBillingDate || row.nextBillingDate > where.nextBillingDate.lte) return false;
    }
    if (where.OR) {
      const matchesOr = where.OR.some((condition: any) => {
        if (condition.expiryDate === null) return row.expiryDate === null;
        if (condition.expiryDate?.gte !== undefined) {
          return row.expiryDate !== null && row.expiryDate >= condition.expiryDate.gte;
        }
        return true;
      });
      if (!matchesOr) return false;
    }
    return true;
  }

  private matchesDiscountWhere(row: Row, where: any): boolean {
    if (where.id !== undefined && row.id !== where.id) return false;
    if (where.timesUsed?.lt !== undefined && !(row.timesUsed < where.timesUsed.lt)) return false;
    return true;
  }

  private recordFindMany(model: string, args: any, returned: number): void {
    this.findManyCalls.push({ model, args, returned });
  }

  private snapshot(): Row[][] {
    return [
      this.customers,
      this.products,
      this.variants,
      this.taxes,
      this.plans,
      this.subscriptions,
      this.subscriptionLines,
      this.discounts,
      this.discountProducts,
      this.invoices,
      this.invoiceLines,
      this.invoiceDiscounts,
      this.billingRuns,
    ].map((rows) => rows.map((row) => ({ ...row })));
  }

  private restore(snapshot: Row[][]): void {
    const target = [
      this.customers,
      this.products,
      this.variants,
      this.taxes,
      this.plans,
      this.subscriptions,
      this.subscriptionLines,
      this.discounts,
      this.discountProducts,
      this.invoices,
      this.invoiceLines,
      this.invoiceDiscounts,
      this.billingRuns,
    ];
    snapshot.forEach((rows, index) => {
      target[index].splice(0, target[index].length, ...rows);
    });
  }

  private nextId(prefix: string): string {
    const next = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, next);
    return `${prefix}-${next}`;
  }
}

function decimal(value: DecimalValue): Prisma.Decimal {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

function sameDate(left: Date, right: Date): boolean {
  return left.getTime() === right.getTime();
}
