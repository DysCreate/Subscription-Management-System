import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { startOfUtcDay, addBillingPeriod, billingPeriodEnd, addUtcDays, parsePaymentTermsDays } from '../common/billing-period/billing-period';
import { decimal, round2, sumDecimals } from '../common/money/money';
import { PrismaService } from '../prisma/prisma.service';
import {
  BILLING_BATCH_SIZE,
  defaultInvoiceStatus,
  defaultPaymentTermsDays,
} from './billing.config';
import {
  allocateDiscount,
  computeDiscountAmount,
  createEvaluationLines,
  selectApplicableDiscounts,
  type DiscountRule,
} from './discount.engine';
import { calculateTax } from './tax.engine';

const BILLING_SUBSCRIPTION_INCLUDE = {
  plan: true,
  lines: {
    include: {
      variant: true,
      tax: true,
      product: { select: { id: true, name: true } },
    },
    orderBy: { id: 'asc' as const },
  },
} satisfies Prisma.SubscriptionInclude;

type BillingSubscription = Prisma.SubscriptionGetPayload<{
  include: typeof BILLING_SUBSCRIPTION_INCLUDE;
}>;

export interface BillingRunSummary {
  id: string;
  startedAt: Date;
  finishedAt: Date | null;
  created: number;
  skipped: number;
  failed: number;
  triggeredBy: string | null;
}

function isUniqueConstraintError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return true;
  }
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Creates the run row up-front so the API can return its id immediately. */
  async createRun(triggeredBy: string): Promise<BillingRunSummary> {
    return this.prisma.billingRun.create({
      data: { triggeredBy, startedAt: new Date() },
    });
  }

  async listRuns(limit = 50): Promise<BillingRunSummary[]> {
    return this.prisma.billingRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: Math.min(200, Math.max(1, limit)),
    });
  }

  async getRun(id: string): Promise<BillingRunSummary> {
    const run = await this.prisma.billingRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException('Billing run not found.');
    return run;
  }

  /**
   * Bills every ACTIVE subscription whose next billing date is due.
   *
   * Batching uses a cursor (`id ASC`) so a large backlog is never loaded into
   * memory. Each subscription is billed in its own transaction. A failure or
   * crash therefore rolls that subscription back and leaves it due for the next
   * run; it can never be silently skipped.
   *
   * Idempotency is enforced by the database unique constraint
   * (subscription_id, period_start, period_end). A concurrent/retried run that
   * loses the race gets P2002 and is counted as skipped.
   */
  async runBilling(
    asOfDate: Date = new Date(),
    triggeredBy = 'manual',
    existingRunId?: string,
  ): Promise<BillingRunSummary> {
    const asOf = startOfUtcDay(asOfDate);
    const runId = await this.startRun(triggeredBy, existingRunId);

    let created = 0;
    let skipped = 0;
    let failed = 0;
    let cursor: string | undefined;

    for (;;) {
      const batch = await this.prisma.subscription.findMany({
        where: {
          status: 'ACTIVE',
          nextBillingDate: { lte: asOf },
          OR: [{ expiryDate: null }, { expiryDate: { gte: asOf } }],
        },
        select: { id: true, nextBillingDate: true },
        orderBy: { id: 'asc' },
        take: BILLING_BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      if (batch.length === 0) break;

      for (const due of batch) {
        if (!due.nextBillingDate) {
          skipped += 1;
          continue;
        }

        const expectedPeriodStart = startOfUtcDay(due.nextBillingDate);
        try {
          const outcome = await this.billOne(due.id, expectedPeriodStart, asOf);
          if (outcome === 'created') created += 1;
          else skipped += 1;
        } catch (error) {
          if (isUniqueConstraintError(error)) {
            skipped += 1;
            this.logger.warn(
              `Subscription ${due.id} was already billed for ${expectedPeriodStart.toISOString().slice(0, 10)}; skipping duplicate.`,
            );
          } else {
            failed += 1;
            this.logger.error(
              `Billing failed for subscription ${due.id}: ${(error as Error).message}`,
              (error as Error).stack,
            );
          }
        }
      }

      cursor = batch[batch.length - 1].id;
      if (batch.length < BILLING_BATCH_SIZE) break;
    }

    const finished = await this.prisma.billingRun.update({
      where: { id: runId },
      data: { finishedAt: new Date(), created, skipped, failed },
    });

    this.logger.log(
      `Billing run ${finished.id} finished: ${created} created, ${skipped} skipped, ${failed} failed`,
    );
    return finished;
  }

  private async startRun(triggeredBy: string, existingRunId?: string): Promise<string> {
    if (existingRunId) {
      await this.prisma.billingRun.update({
        where: { id: existingRunId },
        data: {
          triggeredBy,
          startedAt: new Date(),
          finishedAt: null,
          created: 0,
          skipped: 0,
          failed: 0,
        },
      });
      return existingRunId;
    }

    const run = await this.prisma.billingRun.create({
      data: { triggeredBy, startedAt: new Date() },
    });
    return run.id;
  }

  private async billOne(
    subscriptionId: string,
    expectedPeriodStart: Date,
    asOf: Date,
  ): Promise<'created' | 'skipped'> {
    return this.prisma.$transaction(async (tx) => {
      // Re-read inside the transaction. This is what makes concurrent runs
      // safe: the loser sees the advanced nextBillingDate and skips, or it
      // reaches the unique constraint and rolls back.
      const subscription = await tx.subscription.findUnique({
        where: { id: subscriptionId },
        include: BILLING_SUBSCRIPTION_INCLUDE,
      });

      if (!subscription || subscription.status !== 'ACTIVE') return 'skipped';
      if (!subscription.nextBillingDate) return 'skipped';
      if (startOfUtcDay(subscription.nextBillingDate).getTime() !== expectedPeriodStart.getTime()) {
        return 'skipped';
      }
      if (startOfUtcDay(subscription.nextBillingDate) > asOf) return 'skipped';
      if (subscription.expiryDate && startOfUtcDay(subscription.expiryDate) < asOf) {
        return 'skipped';
      }

      const invoiceLines = this.buildInvoiceLines(subscription);
      if (invoiceLines.length === 0) {
        throw new Error('Subscription has no lines to invoice.');
      }

      const subtotal = sumDecimals(invoiceLines.map((line) => line.amount));
      const taxTotal = sumDecimals(invoiceLines.map((line) => line.taxAmount));

      const appliedDiscounts = await this.applyDiscounts(tx, subscription, invoiceLines, asOf);
      const discountTotal = sumDecimals(appliedDiscounts.map((discount) => discount.amount));
      const total = round2(subtotal.add(taxTotal).sub(discountTotal));

      const periodStart = startOfUtcDay(subscription.nextBillingDate);
      const periodEnd = billingPeriodEnd(periodStart, subscription.plan.billingPeriod);
      const status = defaultInvoiceStatus();
      const dueDate = addUtcDays(
        asOf,
        parsePaymentTermsDays(subscription.paymentTerms, defaultPaymentTermsDays()),
      );
      const number = await this.nextInvoiceNumber(tx);

      await tx.invoice.create({
        data: {
          number,
          subscriptionId: subscription.id,
          customerId: subscription.customerId,
          periodStart,
          periodEnd,
          status,
          subtotal,
          discountTotal,
          taxTotal,
          total,
          dueDate,
          issuedAt: status === 'DRAFT' ? null : new Date(),
          lines: {
            create: invoiceLines.map((line) => ({
              description: line.description,
              quantity: line.quantity,
              qty: line.quantity,
              unitPrice: line.unitPrice,
              taxAmount: line.taxAmount,
              amount: line.amount,
            })),
          },
          discounts: appliedDiscounts.length
            ? {
                create: appliedDiscounts.map((discount) => ({
                  discount: { connect: { id: discount.discountId } },
                  amount: discount.amount,
                })),
              }
            : undefined,
        },
      });

      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          nextBillingDate: addBillingPeriod(periodStart, subscription.plan.billingPeriod),
        },
      });

      return 'created';
    });
  }

  private buildInvoiceLines(subscription: BillingSubscription) {
    return subscription.lines.map((line) => {
      const variantExtra = line.variant ? decimal(line.variant.extraPrice) : new Prisma.Decimal(0);
      const unitPrice = round2(decimal(line.unitPrice).add(variantExtra));
      const amount = round2(unitPrice.mul(line.quantity));
      const taxAmount = calculateTax(
        amount,
        line.tax ? { type: line.tax.type, rate: line.tax.rate } : null,
      );
      const variantLabel = line.variant
        ? ` (${line.variant.attribute}: ${line.variant.value})`
        : '';

      return {
        productId: line.productId,
        description: `${line.product.name}${variantLabel}`,
        quantity: line.quantity,
        unitPrice,
        taxAmount,
        amount,
      };
    });
  }

  private async applyDiscounts(
    tx: Prisma.TransactionClient,
    subscription: BillingSubscription,
    invoiceLines: Array<{ productId: string; quantity: number; amount: Prisma.Decimal }>,
    asOf: Date,
  ): Promise<Array<{ discountId: string; amount: Prisma.Decimal }>> {
    const discounts = await tx.discount.findMany({
      where: { isActive: true },
      include: { products: true },
    });

    const rules: DiscountRule[] = discounts.map((discount) => ({
      id: discount.id,
      type: discount.type,
      value: discount.value,
      minPurchase: discount.minPurchase,
      minQuantity: discount.minQuantity,
      startDate: discount.startDate,
      endDate: discount.endDate,
      usageLimit: discount.usageLimit,
      timesUsed: discount.timesUsed,
      scope: discount.scope,
      isActive: discount.isActive,
      createdAt: discount.createdAt,
      products: discount.products.map((link) => ({ productId: link.productId })),
    }));

    const evaluationLines = createEvaluationLines(invoiceLines);
    const applicable = selectApplicableDiscounts(rules, evaluationLines, asOf);
    const applied: Array<{ discountId: string; amount: Prisma.Decimal }> = [];

    for (const rule of applicable) {
      const amount = computeDiscountAmount(rule, evaluationLines);
      if (amount.lte(0)) continue;

      // Atomic usage-limit gate. Only the run whose UPDATE matches one row may
      // apply the discount; a concurrent run sees count 0 and skips it.
      const usageWhere: Prisma.DiscountWhereInput =
        rule.usageLimit === null
          ? { id: rule.id }
          : { id: rule.id, timesUsed: { lt: rule.usageLimit } };

      const updated = await tx.discount.updateMany({
        where: usageWhere,
        data: { timesUsed: { increment: 1 } },
      });
      if (updated.count !== 1) continue;

      allocateDiscount(rule, evaluationLines, amount);
      applied.push({ discountId: rule.id, amount });
    }

    return applied;
  }

  private async nextInvoiceNumber(tx: Prisma.TransactionClient): Promise<string> {
    const rows = await tx.$queryRaw<Array<{ nextval: bigint }>>`
      SELECT nextval('invoice_number_seq') AS nextval
    `;
    const value = rows[0]?.nextval ?? 1n;
    return `INV-${value.toString().padStart(6, '0')}`;
  }
}
