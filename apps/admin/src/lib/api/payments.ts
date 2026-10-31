import { isSameMonth } from "date-fns";
import type {
  Invoice,
  ListQuery,
  Paginated,
  Payment,
  PaymentMethod,
} from "@/types";
import { apiRequest } from "./client";
import { getStoredCustomers } from "./customers";
import {
  applyInvoicePayment,
  getStoredInvoices,
  invoiceDaysLate,
  isInvoiceRecordOverdue,
  type InvoiceRecord,
} from "./invoices";

/* -------------------------------------------------------------------------- */
/* Payments view model                                                        */
/* -------------------------------------------------------------------------- */

export interface PaymentRecord extends Payment {
  /** Invoice number denormalised for list rendering and CSV export. */
  invoiceNumber: string;
  customerId: string;
  /** Staff member who recorded the payment. */
  recordedBy: string;
}

export interface PaymentStats {
  collectedThisMonth: number;
  outstanding: number;
  outstandingCount: number;
  overdueAmount: number;
  overdueCount: number;
}

export interface PaymentListResult extends Paginated<PaymentRecord> {
  stats: PaymentStats;
}

export interface RecordPaymentInput {
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  /** ISO timestamp. */
  paidAt: string;
  notes?: string;
  recordedBy?: string;
}

export interface RecordPaymentResult {
  payment: PaymentRecord;
  invoice: InvoiceRecord;
}

/* -------------------------------------------------------------------------- */
/* Deterministic mock store                                                   */
/* -------------------------------------------------------------------------- */

const STORAGE_KEY = "subloop_payments_store_v1";

const PAYMENT_METHODS: PaymentMethod[] = [
  "upi",
  "bank_transfer",
  "card",
  "cheque",
  "cash",
];

const RECORDED_BY = [
  "Aarav Menon",
  "Priya Nair",
  "Rahul Verma",
  "Neha Sharma",
];

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function invoiceSequence(invoice: Pick<Invoice, "invoiceNumber">): number {
  return Number(invoice.invoiceNumber.split("-").pop() ?? 0) || 1;
}

function seedPayments(): PaymentRecord[] {
  return getStoredInvoices()
    .filter((invoice) => invoice.amountPaid > 0)
    .map((invoice) => {
      const seq = invoiceSequence(invoice);
      const paidAt =
        invoice.paidAt ??
        new Date(
          new Date(invoice.issueDate).getTime() + 2 * 24 * 60 * 60 * 1000,
        ).toISOString();

      return {
        id: `pay_seed_${invoice.id}`,
        paymentReference: `PAY-${String(seq).padStart(4, "0")}`,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerId: invoice.customerId,
        amount: invoice.amountPaid,
        method: PAYMENT_METHODS[seq % PAYMENT_METHODS.length] ?? "upi",
        paidAt,
        notes:
          invoice.balance > 0
            ? "Part payment received; balance still due."
            : undefined,
        createdAt: paidAt,
        recordedBy: RECORDED_BY[seq % RECORDED_BY.length] ?? RECORDED_BY[0]!,
      };
    });
}

function getStoredPayments(): PaymentRecord[] {
  if (typeof window === "undefined") return seedPayments();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seedPayments();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as PaymentRecord[];
    if (!Array.isArray(parsed)) return seedPayments();
    // Backfill invoice numbers for stores created by older versions.
    return parsed.map((payment) => {
      if (payment.invoiceNumber) return payment;
      const invoice = getStoredInvoices().find(
        (item) => item.id === payment.invoiceId,
      );
      return {
        ...payment,
        invoiceNumber: invoice?.invoiceNumber ?? "—",
        customerId: invoice?.customerId ?? "",
        recordedBy: payment.recordedBy ?? "Aarav Menon",
      };
    });
  } catch {
    return seedPayments();
  }
}

function savePayments(payments: PaymentRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payments));
  } catch {
    // Ignore storage issues
  }
}

/* -------------------------------------------------------------------------- */
/* List + stats                                                               */
/* -------------------------------------------------------------------------- */

function computeStats(payments: PaymentRecord[]): PaymentStats {
  const now = new Date();
  const invoices = getStoredInvoices();
  const stats: PaymentStats = {
    collectedThisMonth: 0,
    outstanding: 0,
    outstandingCount: 0,
    overdueAmount: 0,
    overdueCount: 0,
  };

  for (const payment of payments) {
    if (isSameMonth(new Date(payment.paidAt), now)) {
      stats.collectedThisMonth = round(
        stats.collectedThisMonth + payment.amount,
      );
    }
  }

  for (const invoice of invoices) {
    if (invoice.status !== "confirmed" || invoice.balance <= 0) continue;
    stats.outstanding = round(stats.outstanding + invoice.balance);
    stats.outstandingCount += 1;
    if (isInvoiceRecordOverdue(invoice, now)) {
      stats.overdueAmount = round(stats.overdueAmount + invoice.balance);
      stats.overdueCount += 1;
    }
  }

  return stats;
}

function filterPayments(
  payments: PaymentRecord[],
  params?: ListQuery,
): PaymentRecord[] {
  const filters = params?.filters ?? {};
  let filtered = [...payments];

  if (params?.search?.trim()) {
    const query = params.search.toLowerCase().trim();
    const customers = getStoredCustomers();
    filtered = filtered.filter((payment) => {
      const customer = customers.find(
        (item) => item.id === payment.customerId,
      );
      return (
        payment.invoiceNumber.toLowerCase().includes(query) ||
        payment.paymentReference.toLowerCase().includes(query) ||
        payment.recordedBy.toLowerCase().includes(query) ||
        payment.notes?.toLowerCase().includes(query) ||
        customer?.name.toLowerCase().includes(query) ||
        customer?.companyName?.toLowerCase().includes(query) ||
        customer?.email.toLowerCase().includes(query)
      );
    });
  }

  if (filters["method"] && filters["method"] !== "all") {
    filtered = filtered.filter(
      (payment) => payment.method === filters["method"],
    );
  }

  if (filters["customerId"] && filters["customerId"] !== "all") {
    filtered = filtered.filter(
      (payment) => payment.customerId === filters["customerId"],
    );
  }

  if (filters["dateFrom"]) {
    const from = new Date(filters["dateFrom"]).getTime();
    filtered = filtered.filter(
      (payment) => new Date(payment.paidAt).getTime() >= from,
    );
  }

  if (filters["dateTo"]) {
    const to = new Date(filters["dateTo"]);
    to.setHours(23, 59, 59, 999);
    filtered = filtered.filter(
      (payment) => new Date(payment.paidAt).getTime() <= to.getTime(),
    );
  }

  return filtered;
}

function sortPayments(
  payments: PaymentRecord[],
  sortBy?: string,
  sortOrder: "asc" | "desc" = "desc",
): PaymentRecord[] {
  const direction = sortOrder === "desc" ? -1 : 1;

  return [...payments].sort((a, b) => {
    switch (sortBy) {
      case "amount":
        return (a.amount - b.amount) * direction;
      case "invoiceNumber":
        return a.invoiceNumber.localeCompare(b.invoiceNumber) * direction;
      case "paidAt":
      default:
        return (
          (new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime()) *
          direction
        );
    }
  });
}

export async function getPayments(
  params?: ListQuery,
): Promise<PaymentListResult> {
  return apiRequest<PaymentListResult>("/payments", {
    params,
    mock: () => {
      const base = getStoredPayments();
      const filtered = filterPayments(base, params);
      const sorted = sortPayments(
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
        stats: computeStats(base),
      };
    },
  });
}

export async function getPaymentStats(): Promise<PaymentStats> {
  return apiRequest<PaymentStats>("/payments/stats", {
    mock: () => computeStats(getStoredPayments()),
  });
}

/* -------------------------------------------------------------------------- */
/* Outstanding worklist                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Confirmed invoices with an open balance, sorted by days overdue (desc).
 * Invoices that are not yet due have 0 days late and are ordered by due date.
 */
export async function getOutstandingInvoices(): Promise<InvoiceRecord[]> {
  return apiRequest<InvoiceRecord[]>("/payments/outstanding-invoices", {
    mock: () => {
      const outstanding = getStoredInvoices().filter(
        (invoice) => invoice.status === "confirmed" && invoice.balance > 0,
      );

      return [...outstanding].sort((a, b) => {
        const aLate = invoiceDaysLate(a);
        const bLate = invoiceDaysLate(b);
        if (aLate !== bLate) return bLate - aLate;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Detail + mutation                                                          */
/* -------------------------------------------------------------------------- */

function deriveSeedPayment(invoice: InvoiceRecord): PaymentRecord {
  const seq = invoiceSequence(invoice);
  const paidAt =
    invoice.paidAt ?? new Date(invoice.issueDate).toISOString();
  return {
    id: `pay_seed_${invoice.id}`,
    paymentReference: `PAY-${String(seq).padStart(4, "0")}`,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customerId: invoice.customerId,
    amount: invoice.amountPaid,
    method: PAYMENT_METHODS[seq % PAYMENT_METHODS.length] ?? "upi",
    paidAt,
    notes:
      invoice.balance > 0
        ? "Part payment received; balance still due."
        : undefined,
    createdAt: paidAt,
    recordedBy: RECORDED_BY[seq % RECORDED_BY.length] ?? RECORDED_BY[0]!,
  };
}

export async function getPaymentsForInvoice(
  invoice: InvoiceRecord,
): Promise<PaymentRecord[]> {
  return apiRequest<PaymentRecord[]>(
    `/invoices/${invoice.id}/payments`,
    {
      mock: () => {
        const stored = getStoredPayments().filter(
          (payment) => payment.invoiceId === invoice.id,
        );
        if (stored.length > 0) {
          return [...stored].sort(
            (a, b) =>
              new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime(),
          );
        }
        return invoice.amountPaid > 0 ? [deriveSeedPayment(invoice)] : [];
      },
    },
  );
}

export async function recordPayment(
  input: RecordPaymentInput,
): Promise<RecordPaymentResult> {
  return apiRequest<RecordPaymentResult>("/payments", {
    method: "POST",
    body: input,
    mock: () => {
      const payments = getStoredPayments();
      const invoice = getStoredInvoices().find(
        (item) => item.id === input.invoiceId,
      );
      if (!invoice) throw new Error("Invoice not found");

      const recordedBy = input.recordedBy ?? "Aarav Menon";

      return applyInvoicePayment(invoice.id, {
        amount: input.amount,
        paidAt: input.paidAt,
        actor: recordedBy,
        note: input.notes,
      }).then((updatedInvoice) => {
        const seq = invoiceSequence(updatedInvoice);
        const payment: PaymentRecord = {
          id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          paymentReference: `PAY-${String(seq).padStart(4, "0")}-${String(
            Date.now(),
          ).slice(-4)}`,
          invoiceId: updatedInvoice.id,
          invoiceNumber: updatedInvoice.invoiceNumber,
          customerId: updatedInvoice.customerId,
          amount: round(input.amount),
          method: input.method,
          paidAt: input.paidAt,
          notes: input.notes?.trim() || undefined,
          createdAt: new Date().toISOString(),
          recordedBy,
        };

        payments.push(payment);
        savePayments(payments);
        return { payment, invoice: updatedInvoice };
      });
    },
  });
}
