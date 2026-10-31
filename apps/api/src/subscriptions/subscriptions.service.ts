import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import {
  BILLING_PERIOD_DAYS,
  DEFAULT_QUOTATION_VALIDITY_DAYS,
  paginated,
  resolvePagination,
  SubscriptionAction,
  ACTION_TARGET,
  allowedActions,
  assertTransition,
  type Paginated,
} from '@subloop/shared';
import { AuditService } from '../common/audit/audit.service';
import { rethrowPrismaError } from '../common/prisma/prisma-errors';
import { sumDecimals } from '../common/money/money';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSubscriptionDto,
  CreateSubscriptionFromTemplateDto,
  SubscriptionLineDto,
  UpdateSubscriptionDto,
} from './dto/subscription.dto';

const SUBSCRIPTION_INCLUDE = {
  customer: { select: { id: true, name: true, email: true, phone: true } },
  plan: true,
  lines: {
    include: {
      product: { select: { id: true, name: true, type: true } },
      variant: true,
      tax: true,
    },
    orderBy: { id: 'asc' },
  },
} satisfies Prisma.SubscriptionInclude;

type SubscriptionDetail = Prisma.SubscriptionGetPayload<{ include: typeof SUBSCRIPTION_INCLUDE }>;

type SubscriptionWithTotals = SubscriptionDetail & { subtotal: string };

export interface SubscriptionViewer {
  id: string;
  role: 'ADMIN' | 'STAFF' | 'CUSTOMER';
  customerId: string | null;
}

/** Adds a decimal-safe subtotal for the UI without touching the DB. */
function withTotals(subscription: SubscriptionDetail): SubscriptionWithTotals {
  const subtotal = sumDecimals(subscription.lines.map((line) => line.amount));
  return { ...subscription, subtotal: subtotal.toFixed(2) };
}

/** Adds plan.BILLING_PERIOD days to a date (UTC, date granularity). */
function addPeriod(date: Date, billingPeriod: keyof typeof BILLING_PERIOD_DAYS): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + BILLING_PERIOD_DAYS[billingPeriod]);
  return result;
}

function startOfUtcDay(date: Date): Date {
  const copy = new Date(date.getTime());
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  /** `SUB-000123` from a Postgres sequence, so concurrent creates never collide. */
  private async nextNumber(tx: Prisma.TransactionClient): Promise<string> {
    const rows = await tx.$queryRaw<{ nextval: bigint }[]>`
      SELECT nextval('subscription_number_seq') AS nextval
    `;
    const value = rows[0]?.nextval ?? 1n;
    return `SUB-${value.toString().padStart(6, '0')}`;
  }

  /**
   * Prices each line from the catalog: product sales price plus the chosen
   * variant's extra price, unless an explicit unit price was supplied.
   */
  private async buildLines(
    tx: Prisma.TransactionClient,
    planMinQuantity: number,
    lines: SubscriptionLineDto[],
  ): Promise<Prisma.SubscriptionLineCreateWithoutSubscriptionInput[]> {
    const productIds = [...new Set(lines.map((line) => line.productId))];
    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
      include: { variants: true },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more lines reference a product that does not exist.');
    }

    const productById = new Map(products.map((product) => [product.id, product]));
    const built: Prisma.SubscriptionLineCreateWithoutSubscriptionInput[] = [];

    for (const line of lines) {
      const product = productById.get(line.productId)!;
      if (!product.isActive) {
        throw new BadRequestException(`Product "${product.name}" is no longer available.`);
      }
      if (planMinQuantity > 1 && line.quantity < planMinQuantity) {
        throw new BadRequestException(
          `This plan requires a minimum quantity of ${planMinQuantity} per line.`,
        );
      }

      let unitPrice = new Prisma.Decimal(product.salesPrice);
      if (line.variantId) {
        const variant = product.variants.find((item) => item.id === line.variantId);
        if (!variant) {
          throw new BadRequestException(`The selected variant does not belong to "${product.name}".`);
        }
        unitPrice = unitPrice.add(variant.extraPrice);
      }
      if (line.unitPrice !== undefined) {
        unitPrice = new Prisma.Decimal(line.unitPrice);
      }

      if (line.taxId) {
        const tax = await tx.tax.findUnique({ where: { id: line.taxId } });
        if (!tax || !tax.isActive) {
          throw new BadRequestException('The selected tax rule is not available.');
        }
      }

      built.push({
        product: { connect: { id: product.id } },
        variant: line.variantId ? { connect: { id: line.variantId } } : undefined,
        tax: line.taxId ? { connect: { id: line.taxId } } : undefined,
        quantity: line.quantity,
        unitPrice,
        amount: unitPrice.mul(line.quantity),
      });
    }

    return built;
  }

  private async load(
    tx: Prisma.TransactionClient | PrismaService,
    id: string,
  ): Promise<SubscriptionDetail> {
    const subscription = await tx.subscription.findUnique({
      where: { id },
      include: SUBSCRIPTION_INCLUDE,
    });
    if (!subscription) throw new NotFoundException('Subscription not found.');
    return subscription;
  }

  private async assertCustomer(tx: Prisma.TransactionClient, customerId: string): Promise<void> {
    const customer = await tx.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new BadRequestException('The selected customer does not exist.');
    if (!customer.isActive) throw new BadRequestException('The selected customer is inactive.');
  }

  private async assertPlan(
    tx: Prisma.TransactionClient,
    planId: string,
    startDate: Date,
  ): Promise<{ id: string; minQuantity: number; billingPeriod: keyof typeof BILLING_PERIOD_DAYS }> {
    const plan = await tx.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new BadRequestException('The selected plan does not exist.');
    if (!plan.isActive) throw new BadRequestException('The selected plan is not active.');
    if (plan.availableFrom && startDate < startOfUtcDay(plan.availableFrom)) {
      throw new BadRequestException('This plan is not available yet for the chosen start date.');
    }
    if (plan.availableTo && startDate > plan.availableTo) {
      throw new BadRequestException('This plan is no longer available for the chosen start date.');
    }
    return plan;
  }

  /** Row-level ownership: customers may only ever see their own records. */
  private assertCanView(viewer: SubscriptionViewer | undefined, subscription: { customerId: string }) {
    if (!viewer || viewer.role !== 'CUSTOMER') return;
    if (!viewer.customerId || viewer.customerId !== subscription.customerId) {
      // 404 rather than 403 so ids cannot be probed.
      throw new NotFoundException('Subscription not found.');
    }
  }

  // ---------------------------------------------------------------------
  // Create / read
  // ---------------------------------------------------------------------

  async create(
    dto: CreateSubscriptionDto,
    actorId: string,
  ): Promise<SubscriptionWithTotals> {
    const startDate = startOfUtcDay(dto.startDate ? new Date(dto.startDate) : new Date());

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        await this.assertCustomer(tx, dto.customerId);
        const plan = await this.assertPlan(tx, dto.planId, startDate);
        const lines = await this.buildLines(tx, plan.minQuantity, dto.lines);
        const number = await this.nextNumber(tx);

        return tx.subscription.create({
          data: {
            number,
            customerId: dto.customerId,
            planId: dto.planId,
            status: 'DRAFT',
            startDate,
            expiryDate: dto.expiryDate ? startOfUtcDay(new Date(dto.expiryDate)) : null,
            paymentTerms: dto.paymentTerms ?? null,
            createdById: actorId,
            lines: { create: lines },
            statusHistory: {
              create: { from: null, to: 'DRAFT', byId: actorId, note: 'Subscription created' },
            },
          },
          include: SUBSCRIPTION_INCLUDE,
        });
      });

      await this.auditService.record({
        actorId,
        entity: 'subscription',
        entityId: created.id,
        action: 'SUBSCRIPTION_CREATED',
        diff: { number: created.number, customerId: created.customerId, planId: created.planId },
      });

      return withTotals(created);
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  /** Staff-facing shortcut: prefill plan + lines from an admin quotation template. */
  async createFromTemplate(
    templateId: string,
    dto: CreateSubscriptionFromTemplateDto,
    actorId: string,
  ): Promise<SubscriptionWithTotals> {
    const template = await this.prisma.quotationTemplate.findUnique({
      where: { id: templateId },
      include: { lines: true },
    });
    if (!template) throw new NotFoundException('Quotation template not found.');
    if (!template.isActive) throw new BadRequestException('This quotation template is inactive.');

    return this.create(
      {
        customerId: dto.customerId,
        planId: template.planId,
        startDate: dto.startDate,
        expiryDate: dto.expiryDate,
        paymentTerms: dto.paymentTerms,
        lines: template.lines.map((line) => ({
          productId: line.productId,
          variantId: line.variantId ?? undefined,
          quantity: line.quantity,
        })),
      },
      actorId,
    );
  }

  async findAll(
    viewer: SubscriptionViewer,
    query: {
      page?: string;
      limit?: string;
      status?: SubscriptionStatus;
      customerId?: string;
      planId?: string;
      search?: string;
    },
  ): Promise<Paginated<SubscriptionWithTotals>> {
    const pagination = resolvePagination(query);
    const search = query.search?.trim();

    const where: Prisma.SubscriptionWhereInput = {
      // Customers are always filtered by their own customer id (RBAC row level).
      ...(viewer.role === 'CUSTOMER'
        ? { customerId: viewer.customerId ?? '__none__' }
        : { customerId: query.customerId }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.planId ? { planId: query.planId } : {}),
      ...(search
        ? {
            OR: [
              { number: { contains: search, mode: 'insensitive' } },
              { customer: { name: { contains: search, mode: 'insensitive' } } },
              { customer: { email: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.subscription.findMany({
        where,
        include: SUBSCRIPTION_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.subscription.count({ where }),
    ]);

    return paginated(data.map(withTotals), pagination, total);
  }

  async findOne(id: string, viewer?: SubscriptionViewer): Promise<SubscriptionWithTotals> {
    const subscription = await this.load(this.prisma, id);
    this.assertCanView(viewer, subscription);
    return withTotals(subscription);
  }

  async history(id: string, viewer?: SubscriptionViewer) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
      select: { id: true, customerId: true, number: true },
    });
    if (!subscription) throw new NotFoundException('Subscription not found.');
    this.assertCanView(viewer, subscription);

    return this.prisma.subscriptionStatusHistory.findMany({
      where: { subscriptionId: id },
      include: { by: { select: { id: true, email: true, role: true } } },
      orderBy: { at: 'asc' },
    });
  }

  /** Lines and dates stay editable until the subscription is confirmed. */
  async update(
    id: string,
    dto: UpdateSubscriptionDto,
    actorId: string,
  ): Promise<SubscriptionWithTotals> {
    const existing = await this.load(this.prisma, id);
    if (existing.status !== 'DRAFT' && existing.status !== 'QUOTATION') {
      throw new BadRequestException(
        'Only draft or quotation subscriptions can be edited. Use the lifecycle actions instead.',
      );
    }

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (dto.lines?.length) {
          await tx.subscriptionLine.deleteMany({ where: { subscriptionId: id } });
        }
        const plan = await tx.plan.findUnique({ where: { id: existing.planId } });
        const lines = dto.lines?.length
          ? await this.buildLines(tx, plan?.minQuantity ?? 1, dto.lines)
          : undefined;

        return tx.subscription.update({
          where: { id },
          data: {
            startDate: dto.startDate ? startOfUtcDay(new Date(dto.startDate)) : undefined,
            expiryDate: dto.expiryDate ? startOfUtcDay(new Date(dto.expiryDate)) : undefined,
            paymentTerms: dto.paymentTerms,
            lines: lines ? { create: lines } : undefined,
          },
          include: SUBSCRIPTION_INCLUDE,
        });
      });

      await this.auditService.record({
        actorId,
        entity: 'subscription',
        entityId: id,
        action: 'SUBSCRIPTION_UPDATED',
        diff: { changes: { ...dto, lines: dto.lines?.length ?? 0 } },
      });

      return withTotals(updated);
    } catch (error) {
      rethrowPrismaError(error);
    }
  }

  // ---------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------

  /**
   * Single guarded path for every status change:
   *  1. structural transition check (shared state machine)
   *  2. plan flag check (pausable / closable / renewable)
   *  3. status + history + audit in one transaction
   */
  private async applyAction(
    id: string,
    action: SubscriptionAction,
    actorId: string,
    options: { note?: string; validityDays?: number } = {},
  ): Promise<SubscriptionWithTotals> {
    const existing = await this.load(this.prisma, id);
    const target = ACTION_TARGET[action];

    try {
      assertTransition(existing.status, target);
    } catch {
      throw new BadRequestException(
        `Cannot ${action.replace('_', ' ').toLowerCase()} a subscription that is ${existing.status}. ` +
          `Allowed actions: ${allowedActions(existing.status).join(', ') || 'none'}.`,
      );
    }

    const plan = existing.plan;
    if (action === 'PAUSE' && !plan.pausable) {
      throw new BadRequestException('This plan does not allow pausing.');
    }
    if (action === 'RESUME' && !plan.pausable) {
      throw new BadRequestException('This plan does not allow pausing, so it cannot be resumed.');
    }
    if (action === 'RENEW' && !plan.renewable) {
      throw new BadRequestException('This plan does not allow renewal.');
    }
    if (action === 'RENEW' && existing.status !== 'ACTIVE') {
      throw new BadRequestException('Only an active subscription can be renewed.');
    }
    if (
      action === 'CLOSE' &&
      (existing.status === 'ACTIVE' || existing.status === 'PAUSED') &&
      !plan.closable
    ) {
      throw new BadRequestException('This plan does not allow early closure.');
    }
    if (action === 'ACTIVATE' && existing.lines.length === 0) {
      throw new BadRequestException('A subscription needs at least one line before activation.');
    }

    const now = new Date();
    const data: Prisma.SubscriptionUpdateInput = { status: target };
    let note = options.note;

    switch (action) {
      case 'SEND_QUOTATION': {
        const validity = options.validityDays ?? DEFAULT_QUOTATION_VALIDITY_DAYS;
        data.quotationExpiresAt = new Date(now.getTime() + validity * 86_400_000);
        note = note ?? `Quotation valid for ${validity} day(s)`;
        break;
      }
      case 'CONFIRM':
        data.quotationExpiresAt = null;
        note = note ?? 'Quotation accepted by customer';
        break;
      case 'ACTIVATE':
        data.quotationExpiresAt = null;
        data.pausedAt = null;
        data.nextBillingDate = existing.nextBillingDate ?? existing.startDate;
        note = note ?? 'Subscription activated';
        break;
      case 'PAUSE':
        data.pausedAt = now;
        note = note ?? 'Subscription paused by staff';
        break;
      case 'RESUME': {
        const pausedDays = existing.pausedAt
          ? Math.max(0, Math.ceil((now.getTime() - existing.pausedAt.getTime()) / 86_400_000))
          : 0;
        data.pausedAt = null;
        if (existing.nextBillingDate && pausedDays > 0) {
          const shifted = new Date(existing.nextBillingDate.getTime());
          shifted.setUTCDate(shifted.getUTCDate() + pausedDays);
          data.nextBillingDate = shifted;
        }
        note = note ?? (pausedDays ? `Resumed after ${pausedDays} paused day(s)` : 'Subscription resumed');
        break;
      }
      case 'RENEW': {
        const period = plan.billingPeriod;
        if (existing.expiryDate) {
          data.expiryDate = addPeriod(existing.expiryDate, period);
        }
        data.nextBillingDate = addPeriod(existing.nextBillingDate ?? now, period);
        note = note ?? `Renewed for one ${period.toLowerCase()} period`;
        break;
      }
      case 'CLOSE':
        data.nextBillingDate = null;
        data.pausedAt = null;
        note = note ?? 'Subscription closed';
        break;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.update({
        where: { id },
        data,
        include: SUBSCRIPTION_INCLUDE,
      });
      await tx.subscriptionStatusHistory.create({
        data: { subscriptionId: id, from: existing.status, to: target, byId: actorId, note },
      });
      return subscription;
    });

    await this.auditService.record({
      actorId,
      entity: 'subscription',
      entityId: id,
      action: `SUBSCRIPTION_${action}`,
      diff: {
        number: updated.number,
        from: existing.status,
        to: target,
        ...(data.nextBillingDate ? { nextBillingDate: String(data.nextBillingDate) } : {}),
      },
    });

    return withTotals(updated);
  }

  sendQuotation(id: string, actorId: string, validityDays?: number) {
    return this.applyAction(id, 'SEND_QUOTATION', actorId, { validityDays });
  }

  confirm(id: string, actorId: string) {
    return this.applyAction(id, 'CONFIRM', actorId);
  }

  activate(id: string, actorId: string) {
    return this.applyAction(id, 'ACTIVATE', actorId);
  }

  pause(id: string, actorId: string) {
    return this.applyAction(id, 'PAUSE', actorId);
  }

  resume(id: string, actorId: string) {
    return this.applyAction(id, 'RESUME', actorId);
  }

  renew(id: string, actorId: string) {
    return this.applyAction(id, 'RENEW', actorId);
  }

  close(id: string, actorId: string) {
    return this.applyAction(id, 'CLOSE', actorId);
  }

  // ---------------------------------------------------------------------
  // Background maintenance (called by SubscriptionsScheduler)
  // ---------------------------------------------------------------------

  /**
   * Auto-closes active subscriptions whose expiry date has passed and whose
   * plan says `autoClose`. Batched (200 per round) so a large backlog cannot
   * hold a single long transaction.
   */
  async autoCloseExpired(): Promise<{ closed: number }> {
    let closed = 0;
    const now = new Date();

    for (let round = 0; round < 50; round += 1) {
      const due = await this.prisma.subscription.findMany({
        where: { status: 'ACTIVE', expiryDate: { lt: now }, plan: { autoClose: true } },
        select: { id: true },
        take: 200,
      });
      if (due.length === 0) break;

      for (const { id } of due) {
        await this.prisma.$transaction([
          this.prisma.subscription.update({
            where: { id },
            data: { status: 'CLOSED', nextBillingDate: null, pausedAt: null },
          }),
          this.prisma.subscriptionStatusHistory.create({
            data: {
              subscriptionId: id,
              from: 'ACTIVE',
              to: 'CLOSED',
              note: 'Auto-closed after expiry (plan auto-close enabled)',
            },
          }),
        ]);
        closed += 1;
      }

      if (due.length < 200) break;
    }

    if (closed > 0) this.logger.log(`Auto-closed ${closed} expired subscription(s)`);
    return { closed };
  }

  /** Expires unanswered quotations after their validity window. */
  async expireQuotations(): Promise<{ expired: number }> {
    let expired = 0;
    const now = new Date();

    for (let round = 0; round < 50; round += 1) {
      const due = await this.prisma.subscription.findMany({
        where: { status: 'QUOTATION', quotationExpiresAt: { lt: now } },
        select: { id: true },
        take: 200,
      });
      if (due.length === 0) break;

      for (const { id } of due) {
        await this.prisma.$transaction([
          this.prisma.subscription.update({
            where: { id },
            data: { status: 'CLOSED' },
          }),
          this.prisma.subscriptionStatusHistory.create({
            data: {
              subscriptionId: id,
              from: 'QUOTATION',
              to: 'CLOSED',
              note: 'Quotation expired without confirmation',
            },
          }),
        ]);
        expired += 1;
      }

      if (due.length < 200) break;
    }

    if (expired > 0) this.logger.log(`Expired ${expired} quotation(s)`);
    return { expired };
  }
}

export type { SubscriptionWithTotals };
export type { SubscriptionStatus };
