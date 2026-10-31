import { demoInvoices } from "@/lib/demo-data";
import type { ReportInvoiceStatus } from "@/lib/types";

export type DiscountType = "fixed" | "percent";
export type DiscountScope = "product" | "subscription";
export type BillingInvoiceStatus = "Draft" | "Confirmed" | "Paid" | "Cancelled";
export type PaymentMethod = "UPI" | "Bank transfer" | "Card" | "Cash" | "Cheque";

export interface BillingDiscountRule {
  id: string;
  name: string;
  type: DiscountType;
  value: number;
  minPurchase: number;
  minQuantity: number;
  startsOn: string;
  endsOn: string;
  usageLimit: number;
  timesUsed: number;
  scope: DiscountScope;
  product: string;
  active: boolean;
}

export interface BillingSubscription {
  id: string;
  customer: string;
  plan: string;
  product: string;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
  period: "month" | "year";
  nextBillingDate: string;
  active: boolean;
}

export interface BillingInvoice {
  invoiceNumber: string;
  subscriptionId: string | null;
  billingPeriod: string | null;
  customer: string;
  plan: string;
  dueDate: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  paidAmount: number;
  status: BillingInvoiceStatus;
  discounts: Array<{ name: string; amount: number }>;
  sentAt: string | null;
}

export interface BillingPayment {
  id: string;
  invoiceNumber: string;
  method: PaymentMethod;
  amount: number;
  note: string;
  paidOn: string;
}

export interface BillingDemoState {
  discounts: BillingDiscountRule[];
  subscriptions: BillingSubscription[];
  invoices: BillingInvoice[];
  payments: BillingPayment[];
  nextInvoiceSequence: number;
  nextPaymentSequence: number;
  lastRun: { created: number; skipped: number; failed: number; ranAt: string } | null;
}

export interface BillingRunResult {
  state: BillingDemoState;
  created: BillingInvoice[];
  skipped: number;
  failed: number;
}

const STORAGE_KEY = "subloop.billing-demo.v4";

function toCents(value: number) {
  return Math.round(value * 100);
}

function fromCents(value: number) {
  return value / 100;
}

function toLocalDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addPeriod(date: string, period: BillingSubscription["period"]) {
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(year, month - 1, 1);
  if (period === "year") result.setFullYear(result.getFullYear() + 1);
  else result.setMonth(result.getMonth() + 1);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return toLocalDateString(result);
}

function formatPeriod(start: string, end: string) {
  return `${start}/${end}`;
}

export function createInitialBillingState(today: string): BillingDemoState {
  const nextMonth = addPeriod(today, "month");
  const nextYear = addPeriod(today, "year");
  const demoDiscounts: BillingDiscountRule[] = [
    {
      id: "discount-launch",
      name: "Brightloop launch",
      type: "percent",
      value: 15,
      minPurchase: 2000,
      minQuantity: 1,
      startsOn: today,
      endsOn: nextYear,
      usageLimit: 25,
      timesUsed: 0,
      scope: "subscription",
      product: "",
      active: true,
    },
    {
      id: "discount-starter",
      name: "Starter bundle",
      type: "fixed",
      value: 1000,
      minPurchase: 1000,
      minQuantity: 1,
      startsOn: today,
      endsOn: nextMonth,
      usageLimit: 10,
      timesUsed: 0,
      scope: "product",
      product: "Starter",
      active: true,
    },
    {
      id: "discount-enterprise",
      name: "Enterprise pilot",
      type: "percent",
      value: 5,
      minPurchase: 10000,
      minQuantity: 1,
      startsOn: today,
      endsOn: nextMonth,
      usageLimit: 5,
      timesUsed: 0,
      scope: "subscription",
      product: "",
      active: false,
    },
  ];

  const invoices: BillingInvoice[] = demoInvoices.map((invoice) => ({
    invoiceNumber: invoice.invoiceNumber,
    subscriptionId: null,
    billingPeriod: null,
    customer: invoice.customer,
    plan: invoice.plan,
    dueDate: invoice.dueDate,
    subtotal: invoice.amount,
    discountTotal: 0,
    taxTotal: 0,
    total: invoice.amount,
    paidAmount: invoice.status === "Paid" ? invoice.amount : 0,
    status: invoice.status === "Paid" ? "Paid" : "Confirmed",
    discounts: [],
    sentAt: null,
  }));
  const maxInvoiceNumber = Math.max(
    0,
    ...invoices.map((invoice) => Number(invoice.invoiceNumber.replace(/\D/g, ""))),
  );

  return {
    discounts: demoDiscounts,
    subscriptions: [
      {
        id: "SUB-DEMO-001",
        customer: "Brightloop Studio",
        plan: "Growth",
        product: "Growth",
        quantity: 1,
        unitPrice: 2499,
        taxPercent: 18,
        period: "month",
        nextBillingDate: today,
        active: true,
      },
      {
        id: "SUB-DEMO-002",
        customer: "Aster Labs",
        plan: "Starter",
        product: "Starter",
        quantity: 2,
        unitPrice: 999,
        taxPercent: 18,
        period: "month",
        nextBillingDate: nextMonth,
        active: true,
      },
      {
        id: "SUB-DEMO-003",
        customer: "Northstar Studio",
        plan: "Business Annual",
        product: "Business",
        quantity: 1,
        unitPrice: 24999,
        taxPercent: 18,
        period: "year",
        nextBillingDate: nextYear,
        active: true,
      },
    ],
    invoices,
    payments: [],
    nextInvoiceSequence: maxInvoiceNumber + 1,
    nextPaymentSequence: 1,
    lastRun: null,
  };
}

export function getInvoiceDisplayStatus(invoice: BillingInvoice, today: string): ReportInvoiceStatus | BillingInvoiceStatus {
  if (invoice.status === "Confirmed" && invoice.dueDate < today) return "Overdue";
  if (invoice.status === "Confirmed") return "Outstanding";
  return invoice.status;
}

function calculateDiscounts(
  state: BillingDemoState,
  subscription: BillingSubscription,
  subtotalCents: number,
  today: string,
) {
  let remainingCents = subtotalCents;
  const applied: Array<{ id: string; name: string; amount: number }> = [];
  const applicable = state.discounts
    .filter((rule) => rule.active
      && rule.startsOn <= today
      && rule.endsOn >= today
      && rule.timesUsed < rule.usageLimit
      && fromCents(subtotalCents) >= rule.minPurchase
      && subscription.quantity >= rule.minQuantity
      && (rule.scope === "subscription" || rule.product === subscription.product))
    .sort((left, right) => Number(left.scope === "subscription") - Number(right.scope === "subscription"));

  for (const rule of applicable) {
    const requestedCents = rule.type === "percent"
      ? Math.round(remainingCents * (rule.value / 100))
      : toCents(rule.value);
    const discountCents = Math.min(remainingCents, requestedCents);
    if (discountCents <= 0) continue;

    remainingCents -= discountCents;
    applied.push({ id: rule.id, name: rule.name, amount: fromCents(discountCents) });
  }

  return {
    applied,
    discountCents: subtotalCents - remainingCents,
    taxableCents: remainingCents,
  };
}

export function runBilling(state: BillingDemoState, today: string): BillingRunResult {
  const nextState: BillingDemoState = {
    ...state,
    discounts: state.discounts.map((rule) => ({ ...rule })),
    subscriptions: state.subscriptions.map((subscription) => ({ ...subscription })),
    invoices: [...state.invoices],
    payments: [...state.payments],
  };
  const created: BillingInvoice[] = [];
  let skipped = 0;
  let failed = 0;

  for (const subscription of nextState.subscriptions) {
    if (!subscription.active || subscription.nextBillingDate > today) {
      skipped += 1;
      continue;
    }

    const start = subscription.nextBillingDate;
    const end = addPeriod(start, subscription.period);
    const periodKey = formatPeriod(start, end);
    if (nextState.invoices.some((invoice) =>
      invoice.subscriptionId === subscription.id && invoice.billingPeriod === periodKey
    )) {
      subscription.nextBillingDate = end;
      skipped += 1;
      continue;
    }

    const subtotalCents = toCents(subscription.unitPrice * subscription.quantity);
    if (subtotalCents <= 0 || subscription.taxPercent < 0) {
      failed += 1;
      continue;
    }
    const discountCalculation = calculateDiscounts(nextState, subscription, subtotalCents, today);
    const taxCents = Math.round(discountCalculation.taxableCents * (subscription.taxPercent / 100));
    const totalCents = discountCalculation.taxableCents + taxCents;
    const invoice: BillingInvoice = {
      invoiceNumber: `INV-${String(nextState.nextInvoiceSequence).padStart(5, "0")}`,
      subscriptionId: subscription.id,
      billingPeriod: periodKey,
      customer: subscription.customer,
      plan: subscription.plan,
      dueDate: end,
      subtotal: fromCents(subtotalCents),
      discountTotal: fromCents(discountCalculation.discountCents),
      taxTotal: fromCents(taxCents),
      total: fromCents(totalCents),
      paidAmount: 0,
      status: "Draft",
      discounts: discountCalculation.applied.map(({ name, amount }) => ({ name, amount })),
      sentAt: null,
    };

    nextState.nextInvoiceSequence += 1;
    nextState.invoices.unshift(invoice);
    created.push(invoice);
    for (const applied of discountCalculation.applied) {
      const rule = nextState.discounts.find((item) => item.id === applied.id);
      if (rule) {
        rule.timesUsed += 1;
        if (rule.timesUsed >= rule.usageLimit) rule.active = false;
      }
    }
    subscription.nextBillingDate = end;
  }

  nextState.lastRun = { created: created.length, skipped, failed, ranAt: today };
  return { state: nextState, created, skipped, failed };
}

export function recordDemoPayment(
  state: BillingDemoState,
  input: Omit<BillingPayment, "id">,
  today: string,
): { state: BillingDemoState; error?: string } {
  const invoice = state.invoices.find((item) => item.invoiceNumber === input.invoiceNumber);
  if (!invoice) return { state, error: "Select an existing invoice." };
  if (invoice.status !== "Confirmed") return { state, error: "Only confirmed invoices can receive payments." };
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { state, error: "Enter a payment amount greater than zero." };
  }

  const balanceCents = toCents(invoice.total) - toCents(invoice.paidAmount);
  const paymentCents = toCents(input.amount);
  if (paymentCents <= 0) return { state, error: "Payment must be at least ₹0.01." };
  if (paymentCents > balanceCents) {
    return { state, error: `Payment exceeds the remaining balance of ${fromCents(balanceCents).toFixed(2)}.` };
  }

  const payments = [{
    ...input,
    id: `PAY-${String(state.nextPaymentSequence).padStart(5, "0")}`,
    amount: fromCents(paymentCents),
  }, ...state.payments];
  const invoices = state.invoices.map((item) => {
    if (item.invoiceNumber !== input.invoiceNumber) return item;
    const paidAmount = fromCents(toCents(item.paidAmount) + paymentCents);
    return {
      ...item,
      paidAmount,
      status: paidAmount >= item.total ? "Paid" as const : item.status,
    };
  });

  return {
    state: { ...state, invoices, payments, nextPaymentSequence: state.nextPaymentSequence + 1 },
  };
}

export function isBillingDemoState(value: unknown): value is BillingDemoState {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Partial<BillingDemoState>;
  const isNumber = (item: unknown) => typeof item === "number" && Number.isFinite(item);
  const isString = (item: unknown) => typeof item === "string";
  return Array.isArray(state.discounts)
    && state.discounts.every((item) => typeof item === "object" && item !== null
      && isString(item.id) && isString(item.name)
      && (item.type === "fixed" || item.type === "percent")
      && isNumber(item.value) && isNumber(item.minPurchase) && isNumber(item.minQuantity)
      && isString(item.startsOn) && isString(item.endsOn)
      && isNumber(item.usageLimit) && isNumber(item.timesUsed)
      && (item.scope === "product" || item.scope === "subscription")
      && isString(item.product) && typeof item.active === "boolean")
    && Array.isArray(state.subscriptions)
    && state.subscriptions.every((item) => typeof item === "object" && item !== null
      && isString(item.id) && isString(item.customer) && isString(item.plan) && isString(item.product)
      && isNumber(item.quantity) && isNumber(item.unitPrice) && isNumber(item.taxPercent)
      && (item.period === "month" || item.period === "year")
      && isString(item.nextBillingDate) && typeof item.active === "boolean")
    && Array.isArray(state.invoices)
    && state.invoices.every((item) => typeof item === "object" && item !== null
      && isString(item.invoiceNumber)
      && (item.subscriptionId === null || isString(item.subscriptionId))
      && (item.billingPeriod === null || isString(item.billingPeriod))
      && isString(item.customer) && isString(item.plan) && isString(item.dueDate)
      && isNumber(item.subtotal) && isNumber(item.discountTotal) && isNumber(item.taxTotal)
      && isNumber(item.total) && isNumber(item.paidAmount)
      && (item.status === "Draft" || item.status === "Confirmed" || item.status === "Paid" || item.status === "Cancelled")
      && (item.sentAt === null || isString(item.sentAt))
      && Array.isArray(item.discounts)
      && item.discounts.every((discount) => typeof discount === "object" && discount !== null
        && isString(discount.name) && isNumber(discount.amount)))
    && Array.isArray(state.payments)
    && state.payments.every((item) => typeof item === "object" && item !== null
      && isString(item.id) && isString(item.invoiceNumber)
      && (item.method === "UPI" || item.method === "Bank transfer" || item.method === "Card" || item.method === "Cash" || item.method === "Cheque")
      && isNumber(item.amount) && isString(item.note) && isString(item.paidOn))
    && Number.isInteger(state.nextInvoiceSequence)
    && Number.isInteger(state.nextPaymentSequence)
    && (state.lastRun === null || (typeof state.lastRun === "object"
      && isNumber(state.lastRun.created) && isNumber(state.lastRun.skipped)
      && isNumber(state.lastRun.failed) && isString(state.lastRun.ranAt)));
}

export function normalizeBillingDemoState(state: BillingDemoState): BillingDemoState {
  const ids = new Set<string>();
  const discounts = state.discounts.map((rule, index) => {
    if (!ids.has(rule.id)) {
      ids.add(rule.id);
      return rule;
    }

    let id = `${rule.id}-duplicate-${index}`;
    while (ids.has(id)) id = `${id}-duplicate`;
    ids.add(id);
    return { ...rule, id };
  });
  return discounts.length === state.discounts.length ? state : { ...state, discounts };
}

export function getBillingStorageKey() {
  return STORAGE_KEY;
}
