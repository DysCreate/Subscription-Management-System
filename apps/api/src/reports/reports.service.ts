import { Injectable } from '@nestjs/common';
import { InvoiceStatus, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((startOfDay(b).getTime() - startOfDay(a).getTime()) / (1000 * 60 * 60 * 24));
}

@Injectable()
export class ReportsService {
  private cache = new Map<string, { expires: number; data: any }>();

  constructor(private readonly prisma: PrismaService) {}

  private getCache(key: string) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private setCache(key: string, data: any, ttlSeconds = 60) {
    this.cache.set(key, { expires: Date.now() + ttlSeconds * 1000, data });
  }

  invalidate() {
    this.cache.clear();
  }

  private getRange(from?: string, to?: string) {
    const now = new Date();
    const end = to ? startOfDay(new Date(to)) : startOfDay(now);
    const start = from ? startOfDay(new Date(from)) : startOfDay(addDays(end, -29)); // default 30 days
    return { start, end };
  }

  private getPrevRange(start: Date, end: Date) {
    const length = daysBetween(start, end) + 1;
    const prevEnd = addDays(start, -1);
    const prevStart = addDays(prevEnd, -(length - 1));
    return { start: prevStart, end: prevEnd };
  }

  async summary(from?: string, to?: string) {
    const key = `summary:${from||''}:${to||''}`;
    const cached = this.getCache(key);
    if (cached) return cached;

    const { start, end } = this.getRange(from, to);
    const prev = this.getPrevRange(start, end);

    const [activeNow] = await Promise.all([
      this.prisma.subscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
      this.prisma.subscription.count({ where: { status: SubscriptionStatus.ACTIVE, createdAt: { lte: end } } }), // rough
    ]);

    // MRR/ARR - sum of active subscription plan prices normalized to monthly? Use subscription lines amounts? Or plan price
    const activeSubs = await this.prisma.subscription.findMany({
      where: { status: SubscriptionStatus.ACTIVE },
      include: { plan: true, lines: true },
    });
    let mrr = 0;
    for (const sub of activeSubs) {
      // try to compute monthly equivalent
      const period = sub.plan.billingPeriod;
      let amount = Number(sub.plan.price);
      if (period === 'YEARLY') amount = amount / 12;
      else if (period === 'WEEKLY') amount = amount * 4.33;
      else if (period === 'DAILY') amount = amount * 30;
      mrr += amount;
    }
    const arr = mrr * 12;

    const [revenueCollected, paymentsPrev] = await Promise.all([
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { paidOn: { gte: start, lte: end } },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { paidOn: { gte: prev.start, lte: prev.end } },
      }),
    ]);

    const [outstandingInvoices, overdueInvoices] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { status: InvoiceStatus.CONFIRMED },
        select: { total: true, amountPaid: true, dueDate: true },
      }),
      this.prisma.invoice.findMany({
        where: { status: InvoiceStatus.CONFIRMED },
        select: { total: true, amountPaid: true, dueDate: true },
      }),
    ]);

    let outstanding = 0;
    for (const inv of outstandingInvoices) {
      outstanding += Math.max(0, Number(inv.total) - Number(inv.amountPaid));
    }

    const today = startOfDay(new Date());
    let overdueCount = 0;
    let overdueAmount = 0;
    for (const inv of overdueInvoices) {
      if (startOfDay(inv.dueDate) < today) {
        const bal = Math.max(0, Number(inv.total) - Number(inv.amountPaid));
        if (bal > 0) {
          overdueCount += 1;
          overdueAmount += bal;
        }
      }
    }

    const revenueCollectedNum = Number(revenueCollected._sum.amount || 0);
    const revenuePrevNum = Number(paymentsPrev._sum.amount || 0);
    const deltaRevenue = revenuePrevNum === 0 ? (revenueCollectedNum > 0 ? 100 : 0) : ((revenueCollectedNum - revenuePrevNum) / revenuePrevNum) * 100;

    const result = {
      activeSubscriptions: activeNow,
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(arr * 100) / 100,
      revenueCollected: Math.round(revenueCollectedNum * 100) / 100,
      outstanding: Math.round(outstanding * 100) / 100,
      overdueCount,
      overdueAmount: Math.round(overdueAmount * 100) / 100,
      delta: {
        activeSubscriptions: 0,
        mrr: 0,
        arr: 0,
        revenueCollected: Math.round(deltaRevenue * 100) / 100,
        outstanding: 0,
        overdueCount: 0,
      },
    };
    this.setCache(key, result);
    return result;
  }

  async revenueByMonth() {
    const key = 'revenue-by-month';
    const cached = this.getCache(key);
    if (cached) return cached;
    const result = await this.prisma.$queryRaw<Array<{ month: string; revenue: number }>>`
      SELECT TO_CHAR(paid_on, 'YYYY-MM') as month, COALESCE(SUM(amount), 0) as revenue
      FROM payments
      WHERE paid_on >= (CURRENT_DATE - INTERVAL '12 months')
      GROUP BY TO_CHAR(paid_on, 'YYYY-MM')
      ORDER BY month ASC
    `;
    const data = result.map(r => ({ month: r.month, revenue: Number(r.revenue) }));
    this.setCache(key, data);
    return data;
  }

  async paymentsByMethod() {
    const key = 'payments-by-method';
    const cached = this.getCache(key);
    if (cached) return cached;
    const result = await this.prisma.$queryRaw<Array<{ method: string; amount: number; count: bigint }>>`
      SELECT method, COALESCE(SUM(amount), 0) as amount, COUNT(*) as count
      FROM payments
      GROUP BY method
      ORDER BY amount DESC
    `;
    const data = result.map(r => ({ method: r.method, amount: Number(r.amount), count: Number(r.count) }));
    this.setCache(key, data);
    return data;
  }

  async subscriptionsByStatus() {
    const key = 'subscriptions-by-status';
    const cached = this.getCache(key);
    if (cached) return cached;
    const grouped = await this.prisma.subscription.groupBy({
      by: ['status'],
      _count: { status: true },
    });
    const data = grouped.map(g => ({ status: g.status, count: g._count.status }));
    this.setCache(key, data);
    return data;
  }

  async newVsChurned() {
    const key = 'new-vs-churned';
    const cached = this.getCache(key);
    if (cached) return cached;
    const result = await this.prisma.$queryRaw<Array<{ month: string; new: bigint; churned: bigint }>>`
      SELECT TO_CHAR(created_at, 'YYYY-MM') as month,
             COUNT(*) FILTER (WHERE true) as new,
             0 as churned
      FROM subscriptions
      WHERE created_at >= (CURRENT_DATE - INTERVAL '12 months')
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month ASC
    `;
    const data = result.map(r => ({ month: r.month, new: Number(r.new), churned: Number(r.churned) }));
    this.setCache(key, data);
    return data;
  }

  async overdue(page = 1, limit = 10) {
    const key = `overdue:${page}:${limit}`;
    const cached = this.getCache(key);
    if (cached) return cached;
    const today = startOfDay(new Date());
    const where = { status: InvoiceStatus.CONFIRMED };
    const [invoices] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: { customer: true },
        orderBy: { dueDate: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);
    const items = invoices
      .map(inv => {
        const bal = Math.max(0, Number(inv.total) - Number(inv.amountPaid));
        if (bal <= 0) return null;
        const daysLate = startOfDay(inv.dueDate) < today ? daysBetween(inv.dueDate, today) : 0;
        if (daysLate <= 0) return null;
        return {
          id: inv.id,
          invoiceNumber: inv.number,
          customer: inv.customer?.name,
          customerId: inv.customerId,
          total: Number(inv.total),
          amountPaid: Number(inv.amountPaid),
          balance: bal,
          dueDate: inv.dueDate,
          daysLate,
        };
      })
      .filter(Boolean);
    const result = { items, total: items.length, page, limit, totalPages: Math.ceil(items.length / limit) || 1 };
    this.setCache(key, result);
    return result;
  }

  async renewalsUpcoming() {
    const key = 'renewals-upcoming';
    const cached = this.getCache(key);
    if (cached) return cached;
    const today = startOfDay(new Date());
    const in30 = addDays(today, 30);
    const subs = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        nextBillingDate: { gte: today, lte: in30 },
      },
      include: { customer: true, plan: true },
      orderBy: { nextBillingDate: 'asc' },
    });
    const data = subs.map(s => ({
      id: s.id,
      subscriptionNumber: s.number,
      customer: s.customer?.name,
      customerId: s.customerId,
      plan: s.plan?.name,
      nextBillingDate: s.nextBillingDate,
    }));
    this.setCache(key, data);
    return data;
  }

  async exportCsv(from?: string, to?: string) {
    const summary = await this.summary(from, to);
    const lines = ['metric,value'];
    lines.push(`activeSubscriptions,${summary.activeSubscriptions}`);
    lines.push(`mrr,${summary.mrr}`);
    lines.push(`arr,${summary.arr}`);
    lines.push(`revenueCollected,${summary.revenueCollected}`);
    lines.push(`outstanding,${summary.outstanding}`);
    lines.push(`overdueCount,${summary.overdueCount}`);
    lines.push(`overdueAmount,${summary.overdueAmount}`);
    return lines.join('\n');
  }
}
