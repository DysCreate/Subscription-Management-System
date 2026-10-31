import {
  addDays,
  differenceInCalendarDays,
  isSameMonth,
  startOfDay,
} from "date-fns";
import type {
  Invoice,
  InvoiceLine,
  InvoiceStatus,
  ListQuery,
  Paginated,
  Payment,
  PaymentMethod,
  PaymentTerms,
  Subscription,
} from "@/types";
import { apiRequest } from "./client";
import { getStoredCustomers } from "./customers";
import { MOCK_DISCOUNTS } from "./discounts";
import { getStoredPlans } from "./plans";
import { getStoredProducts } from "./products";
import { getStoredSubscriptions } from "./subscriptions";

/* -------------------------------------------------------------------------- */
/* Invoice view model                                                         */
/* -------------------------------------------------------------------------- */

export interface InvoiceRecord extends Invoice {
  amountPaid: number;
  balance: number;
  subscriptionNumber: string;
  paymentTerms?: PaymentTerms;
  discountName?: string;
  sentAt?: string;
  confirmedAt?: string;
  cancelledAt?: string;
  reminderSentAt?: string;
}

export type InvoiceTabStatus = "all" | InvoiceStatus | "overdue";

export interface InvoiceStatusCounts {
  all: number;
  draft: number;
  confirmed: number;
  paid: number;
  overdue: number;
  cancelled: number;
}

export interface InvoiceStats {
  totalOutstanding: number;
  outstandingCount: number;
  overdueAmount: number;
  overdueCount: number;
  paidThisMonth: number;
  draftCount: number;
}

export interface InvoiceListResult extends Paginated<InvoiceRecord> {
  statusCounts: InvoiceStatusCounts;
  stats: InvoiceStats;
}

export interface InvoiceActivityEvent {
  id: string;
  invoiceId: string;
  title: string;
  description?: string;
  actor: string;
  createdAt: string;
}

export interface BillingRunResult {
  created: number;
  skipped: number;
  failed: number;
  invoiceNumbers: string[];
}

/* -------------------------------------------------------------------------- */
/* Deterministic mock generation                                              */
/* -------------------------------------------------------------------------- */

const STORAGE_KEY = "subloop_invoices_store_v1";
const ACTIVITY_KEY = "subloop_invoice_activity_v1";

const TERM_DAYS: Record<PaymentTerms, number> = {
  immediate: 0,
  net_15: 15,
  net_30: 30,
  net_60: 60,
};

const ACTORS = ["Aarav Menon", "Priya Nair", "Rahul Verma", "Neha Sharma"];
const PAYMENT_METHODS: PaymentMethod[] = [
  "upi",
  "bank_transfer",
  "card",
  "cheque",
];

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function actorFor(seed: number): string {
  return ACTORS[Math.abs(seed) % ACTORS.length] ?? ACTORS[0]!;
}

function termsDays(subscription: Subscription): number {
  return TERM_DAYS[subscription.paymentTerms ?? "immediate"];
}

function buildInvoiceLines(
  subscription: Subscription,
  invoiceId: string,
  invoiceNumber: string,
): InvoiceLine[] {
  const plans = getStoredPlans();
  const products = getStoredProducts();

  return subscription.lines.map((line, index) => {
    const product = products.find((item) => item.id === line.productId);
    const plan = plans.find((item) => item.id === line.planId);
    return {
      id: `${invoiceId}_line_${index}`,
      invoiceId,
      description:
        product || plan
          ? `${product?.name ?? "Subscription"} — ${plan?.name ?? invoiceNumber}`
          : `Recurring subscription — ${invoiceNumber}`,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxRatePercent: line.taxRatePercent,
      discountValue: line.discountValue,
      lineTotal: round(line.quantity * line.unitPrice),
    };
  });
}

interface BuildInvoiceOptions {
  seq: number;
  status: InvoiceStatus;
  issueDate: Date;
  dueDate: Date;
  subIndex: number;
  partialPaid?: boolean;
}

function buildInvoiceRecord(
  subscription: Subscription,
  options: BuildInvoiceOptions,
): InvoiceRecord {
  const { seq, status, issueDate, dueDate, subIndex } = options;
  const invoiceId = `inv_${subscription.id}_${seq}`;
  const invoiceNumber = `INV-${issueDate.getFullYear()}-${String(
    1000 + seq,
  ).padStart(4, "0")}`;
  const lines = buildInvoiceLines(subscription, invoiceId, invoiceNumber);
  const subtotal =
    subscription.subtotal ??
    round(lines.reduce((sum, line) => sum + line.lineTotal, 0));
  const discountTotal = subscription.discountTotal ?? 0;
  const taxTotal = subscription.taxTotal ?? 0;
  const total =
    subscription.total ?? round(subtotal - discountTotal + taxTotal);
  const partialAmount = options.partialPaid
    ? round(total * 0.35)
    : 0;
  const amountPaid = status === "paid" ? total : partialAmount;
  const balance = round(Math.max(total - amountPaid, 0));
  const discount = MOCK_DISCOUNTS.find(
    (item) => item.id === subscription.discountId,
  );

  const paidAt =
    status === "paid"
      ? addDays(issueDate, 2 + (subIndex % 4))
      : options.partialPaid
        ? addDays(issueDate, 2)
        : undefined;

  return {
    id: invoiceId,
    invoiceNumber,
    customerId: subscription.customerId,
    subscriptionId: subscription.id,
    subscriptionNumber: subscription.subscriptionNumber,
    paymentTerms: subscription.paymentTerms ?? "immediate",
    status,
    issueDate: issueDate.toISOString(),
    dueDate: dueDate.toISOString(),
    paidAt: paidAt?.toISOString(),
    lines,
    subtotal,
    discountTotal,
    taxTotal,
    total,
    amountPaid,
    balance,
    discountName: discount?.name ?? discount?.code,
    sentAt:
      status === "draft"
        ? subIndex % 2 === 0
          ? issueDate.toISOString()
          : undefined
        : issueDate.toISOString(),
    confirmedAt:
      status === "confirmed" || status === "paid"
        ? issueDate.toISOString()
        : undefined,
    cancelledAt:
      status === "cancelled" ? addDays(issueDate, 1).toISOString() : undefined,
  };
}

function generateInvoices(): InvoiceRecord[] {
  const subscriptions = getStoredSubscriptions();
  const today = startOfDay(new Date());
  const invoices: InvoiceRecord[] = [];
  let seq = 0;

  subscriptions.forEach((subscription, subIndex) => {
    const count = 2 + (subIndex % 2); // 2–3 invoices per subscription ≈ 150 total.

    for (let index = 0; index < count; index += 1) {
      const isLatest = index === 0;
      let status: InvoiceStatus;

      if (isLatest) {
        if (subIndex % 11 === 0) status = "draft";
        else if (subIndex % 9 === 0) status = "cancelled";
        else if (subIndex % 3 !== 0) status = "confirmed";
        else status = "paid";
      } else {
        status =
          subIndex % 17 === 0 && index === count - 1 ? "cancelled" : "paid";
      }

      const terms = termsDays(subscription);
      let issueDate: Date;
      let dueDate: Date;

      if (status === "confirmed") {
        if (subIndex % 3 === 1) {
          // Confirmed but not yet due.
          dueDate = addDays(today, 5 + (subIndex % 18));
          issueDate = addDays(dueDate, -Math.max(terms, 7));
        } else {
          // Confirmed and overdue.
          dueDate = addDays(today, -(2 + (subIndex % 23)));
          issueDate = addDays(dueDate, -Math.max(terms, 7));
        }
      } else if (status === "draft") {
        issueDate = addDays(today, -(subIndex % 9));
        dueDate = addDays(issueDate, Math.max(terms, 7));
      } else if (status === "cancelled") {
        issueDate = addDays(today, -(10 + (subIndex % 40)));
        dueDate = addDays(issueDate, Math.max(terms, 7));
      } else {
        issueDate = addDays(
          today,
          -(25 + index * 32 + (subIndex % 24)),
        );
        dueDate = addDays(issueDate, Math.max(terms, 5));
      }

      seq += 1;
      invoices.push(
        buildInvoiceRecord(subscription, {
          seq,
          status,
          issueDate,
          dueDate,
          subIndex,
          partialPaid: status === "confirmed" && subIndex % 4 === 0,
        }),
      );
    }
  });

  return invoices.sort(
    (a, b) =>
      new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime(),
  );
}

export function getStoredInvoices(): InvoiceRecord[] {
  if (typeof window === "undefined") return generateInvoices();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const generated = generateInvoices();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(generated));
      return generated;
    }
    const parsed = JSON.parse(raw) as InvoiceRecord[];
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : generateInvoices();
  } catch {
    return generateInvoices();
  }
}

function saveInvoices(invoices: InvoiceRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
  } catch {
    // Ignore storage issues
  }
}

/* -------------------------------------------------------------------------- */
/* Derived helpers                                                            */
/* -------------------------------------------------------------------------- */

export function invoiceDaysLate(
  invoice: Pick<InvoiceRecord, "status" | "dueDate" | "balance">,
  now: Date = new Date(),
): number {
  if (invoice.status !== "confirmed" || invoice.balance <= 0) return 0;
  return Math.max(
    differenceInCalendarDays(now, new Date(invoice.dueDate)),
    0,
  );
}

export function isInvoiceRecordOverdue(
  invoice: Pick<InvoiceRecord, "status" | "dueDate" | "balance">,
  now: Date = new Date(),
): boolean {
  return invoiceDaysLate(invoice, now) > 0;
}

function computeStats(invoices: InvoiceRecord[]): InvoiceStats {
  const now = new Date();
  const stats: InvoiceStats = {
    totalOutstanding: 0,
    outstandingCount: 0,
    overdueAmount: 0,
    overdueCount: 0,
    paidThisMonth: 0,
    draftCount: 0,
  };

  for (const invoice of invoices) {
    if (invoice.status === "draft") stats.draftCount += 1;

    if (invoice.status === "confirmed") {
      stats.totalOutstanding = round(stats.totalOutstanding + invoice.balance);
      stats.outstandingCount += 1;
      if (isInvoiceRecordOverdue(invoice, now)) {
        stats.overdueAmount = round(stats.overdueAmount + invoice.balance);
        stats.overdueCount += 1;
      }
    }

    if (
      invoice.amountPaid > 0 &&
      invoice.paidAt &&
      isSameMonth(new Date(invoice.paidAt), now)
    ) {
      stats.paidThisMonth = round(stats.paidThisMonth + invoice.amountPaid);
    }
  }

  return stats;
}

/* -------------------------------------------------------------------------- */
/* List API                                                                   */
/* -------------------------------------------------------------------------- */

function filterInvoices(
  invoices: InvoiceRecord[],
  params?: ListQuery,
): InvoiceRecord[] {
  const filters = params?.filters ?? {};
  const now = new Date();
  let filtered = [...invoices];

  if (params?.search?.trim()) {
    const query = params.search.toLowerCase().trim();
    const customers = getStoredCustomers();
    filtered = filtered.filter((invoice) => {
      const customer = customers.find(
        (item) => item.id === invoice.customerId,
      );
      return (
        invoice.invoiceNumber.toLowerCase().includes(query) ||
        invoice.subscriptionNumber.toLowerCase().includes(query) ||
        customer?.name.toLowerCase().includes(query) ||
        customer?.companyName?.toLowerCase().includes(query) ||
        customer?.email.toLowerCase().includes(query)
      );
    });
  }

  if (filters["customerId"] && filters["customerId"] !== "all") {
    filtered = filtered.filter(
      (invoice) => invoice.customerId === filters["customerId"],
    );
  }

  if (filters["dateFrom"]) {
    const from = new Date(filters["dateFrom"]).getTime();
    filtered = filtered.filter(
      (invoice) => new Date(invoice.issueDate).getTime() >= from,
    );
  }

  if (filters["dateTo"]) {
    const to = new Date(filters["dateTo"]);
    to.setHours(23, 59, 59, 999);
    filtered = filtered.filter(
      (invoice) => new Date(invoice.issueDate).getTime() <= to.getTime(),
    );
  }

  if (filters["overdueOnly"] === "true") {
    filtered = filtered.filter((invoice) =>
      isInvoiceRecordOverdue(invoice, now),
    );
  }

  if (filters["status"] && filters["status"] !== "all") {
    const status = filters["status"];
    if (status === "overdue") {
      filtered = filtered.filter((invoice) =>
        isInvoiceRecordOverdue(invoice, now),
      );
    } else {
      filtered = filtered.filter((invoice) => invoice.status === status);
    }
  }

  return filtered;
}

function sortInvoices(
  invoices: InvoiceRecord[],
  sortBy?: string,
  sortOrder: "asc" | "desc" = "desc",
): InvoiceRecord[] {
  const direction = sortOrder === "desc" ? -1 : 1;
  const key = sortBy ?? "issueDate";

  return [...invoices].sort((a, b) => {
    const valueFor = (invoice: InvoiceRecord): string | number => {
      switch (key) {
        case "invoiceNumber":
          return invoice.invoiceNumber;
        case "dueDate":
          return new Date(invoice.dueDate).getTime();
        case "total":
          return invoice.total;
        case "amountPaid":
          return invoice.amountPaid;
        case "balance":
          return invoice.balance;
        case "status":
          return invoice.status;
        case "issueDate":
        default:
          return new Date(invoice.issueDate).getTime();
      }
    };

    const aValue = valueFor(a);
    const bValue = valueFor(b);
    if (typeof aValue === "number" && typeof bValue === "number") {
      return (aValue - bValue) * direction;
    }
    return String(aValue).localeCompare(String(bValue)) * direction;
  });
}

export async function getInvoices(
  params?: ListQuery,
): Promise<InvoiceListResult> {
  // If using real API, call backend; mock still works behind flag
  return apiRequest<InvoiceListResult>("/invoices", {
    params,
    mock: () => {
      const base = getStoredInvoices();
      const filters = params?.filters ?? {};

      const withoutStatus: ListQuery = {
        ...params,
        filters: { ...filters, status: "all" },
      };
      const beforeStatus = filterInvoices(base, withoutStatus);
      const statusCounts: InvoiceStatusCounts = {
        all: beforeStatus.length,
        draft: beforeStatus.filter((invoice) => invoice.status === "draft")
          .length,
        confirmed: beforeStatus.filter(
          (invoice) => invoice.status === "confirmed",
        ).length,
        paid: beforeStatus.filter((invoice) => invoice.status === "paid")
          .length,
        overdue: beforeStatus.filter((invoice) =>
          isInvoiceRecordOverdue(invoice),
        ).length,
        cancelled: beforeStatus.filter(
          (invoice) => invoice.status === "cancelled",
        ).length,
      };

      const filtered = filterInvoices(base, params);
      const sorted = sortInvoices(
        filtered,
        params?.sortBy,
        params?.sortOrder,
      );
      const page = Math.max(params?.page ?? 1, 1);
      const pageSize = params?.pageSize ?? 15;
      const start = (page - 1) * pageSize;

      return {
        items: sorted.slice(start, start + pageSize),
        total: sorted.length,
        page,
        pageSize,
        totalPages: Math.ceil(sorted.length / pageSize) || 1,
        statusCounts,
        stats: computeStats(base),
      };
    },
  });
}

export async function getInvoiceById(
  id: string,
): Promise<InvoiceRecord | undefined> {
  return apiRequest<InvoiceRecord | undefined>(`/invoices/${id}`, {
    mock: () => getStoredInvoices().find((invoice) => invoice.id === id),
  });
}

/** Invoices for the subscription detail page (backwards-compatible helper). */
export async function getInvoicesForSubscription(
  subscription: Subscription,
): Promise<InvoiceRecord[]> {
  return apiRequest<InvoiceRecord[]>(
    `/subscriptions/${subscription.id}/invoices`,
    {
      mock: () => {
        const stored = getStoredInvoices();
        let list = stored.filter(
          (invoice) => invoice.subscriptionId === subscription.id,
        );

        if (list.length === 0) {
          const today = startOfDay(new Date());
          const seq = stored.length + 1;
          const terms = termsDays(subscription);
          const generated = [
            buildInvoiceRecord(subscription, {
              seq,
              status: "confirmed",
              issueDate: addDays(today, -40),
              dueDate: addDays(today, -(40 - Math.max(terms, 5))),
              subIndex: 1,
            }),
            buildInvoiceRecord(subscription, {
              seq: seq + 1,
              status: "paid",
              issueDate: addDays(today, -100),
              dueDate: addDays(today, -100 + Math.max(terms, 5)),
              subIndex: 2,
            }),
          ];
          saveInvoices([...generated, ...stored]);
          list = generated;
        }

        return [...list].sort(
          (a, b) =>
            new Date(b.issueDate).getTime() -
            new Date(a.issueDate).getTime(),
        );
      },
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Mutations                                                                  */
/* -------------------------------------------------------------------------- */

function readActivityStore(): Record<string, InvoiceActivityEvent[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, InvoiceActivityEvent[]>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeActivityStore(
  store: Record<string, InvoiceActivityEvent[]>,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage issues
  }
}

function recordInvoiceActivity(
  invoiceId: string,
  title: string,
  actor: string,
  description?: string,
): InvoiceActivityEvent {
  const event: InvoiceActivityEvent = {
    id: `iact_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    invoiceId,
    title,
    description,
    actor,
    createdAt: new Date().toISOString(),
  };
  const store = readActivityStore();
  store[invoiceId] = [...(store[invoiceId] ?? []), event];
  writeActivityStore(store);
  return event;
}

export async function updateInvoiceStatus(
  id: string,
  status: InvoiceStatus,
  actor = "Aarav Menon",
): Promise<InvoiceRecord> {
  return apiRequest<InvoiceRecord>(`/invoices/${id}/status`, {
    method: "PATCH",
    body: { status },
    mock: () => {
      const list = getStoredInvoices();
      const index = list.findIndex((invoice) => invoice.id === id);
      if (index === -1) throw new Error("Invoice not found");
      const existing = list[index]!;
      const now = new Date().toISOString();
      const updated: InvoiceRecord = {
        ...existing,
        status,
        confirmedAt:
          status === "confirmed" ? now : existing.confirmedAt,
        cancelledAt: status === "cancelled" ? now : existing.cancelledAt,
      };
      list[index] = updated;
      saveInvoices(list);

      if (status === "confirmed") {
        recordInvoiceActivity(
          id,
          "Invoice confirmed",
          actor,
          `${updated.invoiceNumber} moved from draft to confirmed.`,
        );
      } else if (status === "cancelled") {
        recordInvoiceActivity(
          id,
          "Invoice cancelled",
          actor,
          `${updated.invoiceNumber} was cancelled.`,
        );
      }

      return updated;
    },
  });
}

export async function sendInvoice(
  id: string,
  actor = "Aarav Menon",
): Promise<InvoiceRecord> {
  return apiRequest<InvoiceRecord>(`/invoices/${id}/send`, {
    method: "POST",
    mock: () => {
      const list = getStoredInvoices();
      const index = list.findIndex((invoice) => invoice.id === id);
      if (index === -1) throw new Error("Invoice not found");
      const updated: InvoiceRecord = {
        ...list[index]!,
        sentAt: new Date().toISOString(),
      };
      list[index] = updated;
      saveInvoices(list);
      recordInvoiceActivity(
        id,
        "Invoice sent to customer",
        actor,
        `Emailed ${updated.invoiceNumber} to the billing contact.`,
      );
      return updated;
    },
  });
}

export async function sendInvoices(
  ids: string[],
  actor = "Aarav Menon",
): Promise<{ updated: number; skipped: number }> {
  return apiRequest<{ updated: number; skipped: number }>("/invoices/send", {
    method: "POST",
    body: { ids },
    mock: () => {
      const idSet = new Set(ids);
      const list = getStoredInvoices();
      let updated = 0;
      let skipped = 0;

      list.forEach((invoice) => {
        if (!idSet.has(invoice.id)) return;
        if (invoice.status === "cancelled" || invoice.status === "paid") {
          skipped += 1;
          return;
        }
        invoice.sentAt = new Date().toISOString();
        updated += 1;
      });

      saveInvoices(list);
      if (updated > 0) {
        recordInvoiceActivity(
          ids[0] ?? "bulk",
          "Invoices sent to customers",
          actor,
          `${updated} invoice${updated === 1 ? "" : "s"} emailed.`,
        );
      }
      return { updated, skipped };
    },
  });
}

export async function confirmInvoices(
  ids: string[],
  actor = "Aarav Menon",
): Promise<{ updated: number; skipped: number }> {
  return apiRequest<{ updated: number; skipped: number }>(
    "/invoices/confirm",
    {
      method: "POST",
      body: { ids },
      mock: () => {
        const idSet = new Set(ids);
        const list = getStoredInvoices();
        const now = new Date().toISOString();
        let updated = 0;
        let skipped = 0;

        list.forEach((invoice) => {
          if (!idSet.has(invoice.id)) return;
          if (invoice.status !== "draft") {
            skipped += 1;
            return;
          }
          invoice.status = "confirmed";
          invoice.confirmedAt = now;
          updated += 1;
        });

        saveInvoices(list);
        return { updated, skipped };
      },
    },
  );
}

export interface ApplyInvoicePaymentInput {
  amount: number;
  /** ISO timestamp of when the payment was received. */
  paidAt: string;
  actor?: string;
  note?: string;
}

/**
 * Applies a full or partial payment to a confirmed invoice.
 * Used by the reusable RecordPaymentDialog via the payments API.
 */
export async function applyInvoicePayment(
  id: string,
  input: ApplyInvoicePaymentInput,
): Promise<InvoiceRecord> {
  return apiRequest<InvoiceRecord>(`/invoices/${id}/payments`, {
    method: "POST",
    body: input,
    mock: () => {
      const list = getStoredInvoices();
      const index = list.findIndex((invoice) => invoice.id === id);
      if (index === -1) throw new Error("Invoice not found");

      const existing = list[index]!;
      if (existing.status !== "confirmed" || existing.balance <= 0) {
        throw new Error("Only confirmed invoices with a balance can be paid");
      }
      if (!Number.isFinite(input.amount) || input.amount <= 0) {
        throw new Error("Payment amount must be greater than zero");
      }
      if (input.amount > existing.balance + 0.005) {
        throw new Error(
          `Payment cannot exceed the balance due of ${round(existing.balance)}`,
        );
      }

      const actor = input.actor ?? "Aarav Menon";
      const amountPaid = round(existing.amountPaid + input.amount);
      const balance = round(Math.max(existing.total - amountPaid, 0));
      const isSettled = balance <= 0.005;
      const updated: InvoiceRecord = {
        ...existing,
        amountPaid,
        balance: isSettled ? 0 : balance,
        status: isSettled ? "paid" : existing.status,
        paidAt: isSettled ? input.paidAt : existing.paidAt,
      };

      list[index] = updated;
      saveInvoices(list);
      recordInvoiceActivity(
        id,
        isSettled ? "Payment received" : "Part payment received",
        actor,
        `${input.note?.trim() || `${formatPaise(input.amount)} received against ${updated.invoiceNumber}.`}${
          isSettled
            ? " Invoice fully paid."
            : ` Balance remaining: ${formatPaise(updated.balance)}.`
        }`,
      );

      return updated;
    },
  });
}

function formatPaise(value: number): string {
  return `₹${round(value).toLocaleString("en-IN")}`;
}

/** Records a payment reminder against an outstanding invoice. */
export async function sendInvoiceReminder(
  id: string,
  actor = "Aarav Menon",
): Promise<InvoiceRecord> {
  return apiRequest<InvoiceRecord>(`/invoices/${id}/remind`, {
    method: "POST",
    mock: () => {
      const list = getStoredInvoices();
      const index = list.findIndex((invoice) => invoice.id === id);
      if (index === -1) throw new Error("Invoice not found");
      const updated: InvoiceRecord = {
        ...list[index]!,
        reminderSentAt: new Date().toISOString(),
      };
      list[index] = updated;
      saveInvoices(list);
      recordInvoiceActivity(
        id,
        "Payment reminder sent",
        actor,
        `Reminder emailed for ${updated.invoiceNumber} (${formatPaise(
          updated.balance,
        )} due).`,
      );
      return updated;
    },
  });
}

export async function runBilling(): Promise<BillingRunResult> {
  return apiRequest<BillingRunResult>("/invoices/run-billing", {
    method: "POST",
    mock: () => {
      const stored = getStoredInvoices();
      const subscriptions = getStoredSubscriptions().filter(
        (subscription) => subscription.status === "active",
      );
      const today = startOfDay(new Date());
      const todayKey = today.toISOString().slice(0, 10);
      const invoiceNumbers: string[] = [];
      let created = 0;
      let skipped = 0;
      let failed = 0;
      let seq =
        stored.reduce((max, invoice) => {
          const numeric = Number(invoice.invoiceNumber.split("-").pop() ?? 0);
          return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
        }, 1000) - 1000;

      subscriptions.forEach((subscription, index) => {
        if (index % 7 === 6) {
          failed += 1;
          return;
        }
        if (index % 3 === 0) {
          skipped += 1;
          return;
        }

        const alreadyBilled = stored.some(
          (invoice) =>
            invoice.subscriptionId === subscription.id &&
            invoice.issueDate.slice(0, 10) === todayKey,
        );
        if (alreadyBilled) {
          skipped += 1;
          return;
        }

        const terms = termsDays(subscription);
        seq += 1;
        const invoice = buildInvoiceRecord(subscription, {
          seq,
          status: "confirmed",
          issueDate: today,
          dueDate: addDays(today, Math.max(terms, 0)),
          subIndex: index,
        });
        stored.unshift(invoice);
        invoiceNumbers.push(invoice.invoiceNumber);
        created += 1;
      });

      saveInvoices(stored);
      return { created, skipped, failed, invoiceNumbers };
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Detail helpers                                                             */
/* -------------------------------------------------------------------------- */

export async function getInvoicePayments(
  invoice: InvoiceRecord,
): Promise<Payment[]> {
  return apiRequest<Payment[]>(`/invoices/${invoice.id}/payments`, {
    mock: () => {
      if (invoice.amountPaid <= 0) return [];
      const numeric =
        Number(invoice.invoiceNumber.split("-").pop() ?? 0) || 1;
      const paidAt =
        invoice.paidAt ??
        addDays(new Date(invoice.issueDate), 2).toISOString();

      return [
        {
          id: `pay_${invoice.id}`,
          paymentReference: `PAY-${String(numeric).padStart(4, "0")}`,
          invoiceId: invoice.id,
          amount: invoice.amountPaid,
          method:
            PAYMENT_METHODS[numeric % PAYMENT_METHODS.length] ?? "upi",
          paidAt,
          notes:
            invoice.balance > 0
              ? "Part payment received; balance still due."
              : undefined,
          createdAt: paidAt,
        },
      ];
    },
  });
}

function seedInvoiceActivity(
  invoice: InvoiceRecord,
): InvoiceActivityEvent[] {
  const numeric =
    Number(invoice.invoiceNumber.replace(/\D/g, "")) || 0;
  const events: InvoiceActivityEvent[] = [];
  const created = addDays(new Date(invoice.issueDate), -1).toISOString();
  events.push({
    id: `seed_${invoice.id}_created`,
    invoiceId: invoice.id,
    title: "Invoice created",
    description: `${invoice.invoiceNumber} generated for ${invoice.subscriptionNumber}.`,
    actor: actorFor(numeric),
    createdAt: created,
  });

  if (invoice.sentAt) {
    events.push({
      id: `seed_${invoice.id}_sent`,
      invoiceId: invoice.id,
      title: "Invoice sent to customer",
      actor: actorFor(numeric + 1),
      createdAt: invoice.sentAt,
    });
  }

  if (invoice.confirmedAt) {
    events.push({
      id: `seed_${invoice.id}_confirmed`,
      invoiceId: invoice.id,
      title: "Invoice confirmed",
      actor: actorFor(numeric + 2),
      createdAt: invoice.confirmedAt,
    });
  }

  if (invoice.amountPaid > 0 && invoice.paidAt) {
    events.push({
      id: `seed_${invoice.id}_paid`,
      invoiceId: invoice.id,
      title:
        invoice.balance > 0 ? "Part payment received" : "Payment received",
      description: `₹${invoice.amountPaid.toLocaleString("en-IN")} collected.`,
      actor: actorFor(numeric + 3),
      createdAt: invoice.paidAt,
    });
  }

  if (invoice.cancelledAt) {
    events.push({
      id: `seed_${invoice.id}_cancelled`,
      invoiceId: invoice.id,
      title: "Invoice cancelled",
      actor: actorFor(numeric + 4),
      createdAt: invoice.cancelledAt,
    });
  }

  return events;
}

export async function getInvoiceActivity(
  invoice: InvoiceRecord,
): Promise<InvoiceActivityEvent[]> {
  return apiRequest<InvoiceActivityEvent[]>(
    `/invoices/${invoice.id}/activity`,
    {
      mock: () => {
        const recorded = readActivityStore()[invoice.id] ?? [];
        const recordedTitles = new Set(recorded.map((event) => event.title));
        const seeded = seedInvoiceActivity(invoice).filter(
          (event) => !recordedTitles.has(event.title),
        );

        return [...seeded, ...recorded].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() -
            new Date(b.createdAt).getTime(),
        );
      },
    },
  );
}
