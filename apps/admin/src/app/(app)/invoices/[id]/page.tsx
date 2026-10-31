"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Ban,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  Mail,
  Printer,
  Receipt,
  Send,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ErrorState } from "@/components/error-state";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatRelative,
} from "@/lib/format";
import { getAllCustomers } from "@/lib/api/customers";
import {
  getInvoiceActivity,
  getInvoiceById,
  invoiceDaysLate,
  isInvoiceRecordOverdue,
  sendInvoice,
  updateInvoiceStatus,
  type InvoiceActivityEvent,
  type InvoiceRecord,
} from "@/lib/api/invoices";
import { getPaymentsForInvoice } from "@/lib/api/payments";
import { RecordPaymentDialog } from "@/features/payments/record-payment-dialog";
import type { InvoiceStatus, Payment, PaymentMethod } from "@/types";
import { cn } from "@/lib/utils";

const COMPANY = {
  name: "Brightloop Software",
  address:
    "3rd Floor, Cinnamon House, 7th Block, Koramangala, Bengaluru, Karnataka 560095",
  email: "billing@brightloop.software",
  phone: "+91 80 4718 2200",
  gstin: "29AABCB9184P1Z6",
};

const TERM_LABELS: Record<string, string> = {
  immediate: "Due immediately",
  net_15: "Net 15",
  net_30: "Net 30",
  net_60: "Net 60",
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  card: "Card",
  bank_transfer: "Bank transfer",
  upi: "UPI",
  cash: "Cash",
  cheque: "Cheque",
};

const STEPS: Array<{ status: InvoiceStatus; label: string }> = [
  { status: "draft", label: "Draft" },
  { status: "confirmed", label: "Confirmed" },
  { status: "paid", label: "Paid" },
];

const ACTIVITY_ICONS = {
  created: Receipt,
  sent: Mail,
  confirmed: CheckCircle2,
  paid: Wallet,
  cancelled: Ban,
};

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function statusIndex(status: InvoiceStatus): number {
  if (status === "draft") return 0;
  if (status === "confirmed") return 1;
  if (status === "paid") return 2;
  return -1;
}

function activityIcon(event: InvoiceActivityEvent) {
  const title = event.title.toLowerCase();
  if (title.includes("sent")) return ACTIVITY_ICONS.sent;
  if (title.includes("confirm")) return ACTIVITY_ICONS.confirmed;
  if (title.includes("payment")) return ACTIVITY_ICONS.paid;
  if (title.includes("cancel")) return ACTIVITY_ICONS.cancelled;
  return ACTIVITY_ICONS.created;
}

function InvoiceStepper({ status }: { status: InvoiceStatus }) {
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
        <Ban className="h-4 w-4" />
        This invoice was cancelled and will not be collected.
      </div>
    );
  }

  const current = statusIndex(status);

  return (
    <div className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3 shadow-sm">
      {STEPS.map((step, index) => {
        const complete = index < current;
        const active = index === current;
        return (
          <React.Fragment key={step.status}>
            {index > 0 && (
              <div
                className={cn(
                  "h-0.5 flex-1 rounded-full",
                  index <= current ? "bg-indigo-500" : "bg-border",
                )}
              />
            )}
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold",
                  complete && "border-indigo-600 bg-indigo-600 text-white",
                  active &&
                    "border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-900",
                  !complete &&
                    !active &&
                    "border-border bg-background text-muted-foreground",
                )}
                aria-current={active ? "step" : undefined}
              >
                {complete ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-xs font-medium",
                  active && "text-indigo-700 dark:text-indigo-300",
                  !active && "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function InvoiceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const actor = user?.name ?? "Aarav Menon";

  const [isActing, setIsActing] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [sendOpen, setSendOpen] = React.useState(false);
  const [paymentOpen, setPaymentOpen] = React.useState(false);

  const invoiceQuery = useQuery({
    queryKey: ["invoice", params.id],
    queryFn: () => getInvoiceById(params.id),
  });
  const customersQuery = useQuery({
    queryKey: ["customers", "all"],
    queryFn: getAllCustomers,
  });

  const invoice = invoiceQuery.data;

  const paymentsQuery = useQuery({
    queryKey: ["invoice", params.id, "payments"],
    queryFn: () => getPaymentsForInvoice(invoice!),
    enabled: Boolean(invoice),
  });
  const activityQuery = useQuery({
    queryKey: ["invoice", params.id, "activity"],
    queryFn: () => getInvoiceActivity(invoice!),
    enabled: Boolean(invoice),
  });

  const customer = (customersQuery.data ?? []).find(
    (item) => item.id === invoice?.customerId,
  );

  const invalidate = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["invoice", params.id] }),
      queryClient.invalidateQueries({ queryKey: ["invoices"] }),
    ]);
  }, [queryClient, params.id]);

  const handleConfirm = async () => {
    if (!invoice) return;
    setIsActing(true);
    try {
      await updateInvoiceStatus(invoice.id, "confirmed", actor);
      toast.success("Invoice confirmed");
      await invalidate();
    } catch {
      toast.error("Could not confirm the invoice");
    } finally {
      setIsActing(false);
    }
  };

  const handleCancel = async () => {
    if (!invoice) return;
    setIsActing(true);
    try {
      await updateInvoiceStatus(invoice.id, "cancelled", actor);
      toast.success("Invoice cancelled");
      setCancelOpen(false);
      await invalidate();
    } catch {
      toast.error("Could not cancel the invoice");
    } finally {
      setIsActing(false);
    }
  };

  const handleSend = async () => {
    if (!invoice) return;
    setIsActing(true);
    try {
      await sendInvoice(invoice.id, actor);
      toast.success(
        `Invoice sent to ${customer?.email ?? "the billing contact"}`,
      );
      setSendOpen(false);
      await invalidate();
    } catch {
      toast.error("Could not send the invoice");
    } finally {
      setIsActing(false);
    }
  };

  if (invoiceQuery.error) {
    return (
      <ErrorState
        title="Invoice not found"
        message="The invoice could not be loaded. It may have been removed."
        onRetry={() => invoiceQuery.refetch()}
      />
    );
  }

  if (invoiceQuery.isLoading || !invoice) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Skeleton className="h-[560px]" />
          <div className="space-y-6">
            <Skeleton className="h-52" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  const overdue = isInvoiceRecordOverdue(invoice);
  const daysLate = invoiceDaysLate(invoice);
  const payments: Payment[] = paymentsQuery.data ?? [];
  const activity: InvoiceActivityEvent[] = [...(activityQuery.data ?? [])].reverse();
  const taxGroups = Array.from(
    invoice.lines.reduce((groups, line) => {
      const rate = line.taxRatePercent;
      const current = groups.get(rate) ?? { taxable: 0, tax: 0 };
      current.taxable += line.lineTotal;
      current.tax += (line.lineTotal * rate) / 100;
      groups.set(rate, current);
      return groups;
    }, new Map<number, { taxable: number; tax: number }>()),
  ).sort(([a], [b]) => a - b);
  const computedTax = taxGroups.reduce((sum, [, value]) => sum + value.tax, 0);
  const taxFactor = computedTax > 0 ? invoice.taxTotal / computedTax : 0;

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #invoice-document, #invoice-document * { visibility: visible !important; }
          #invoice-document {
            position: absolute; left: 0; top: 0; width: 100%;
            border: 0 !important; box-shadow: none !important;
            background: #ffffff !important; color: #0f172a !important;
          }
          .invoice-no-print { display: none !important; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="invoice-no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="icon" className="h-9 w-9">
            <Link href="/invoices" aria-label="Back to invoices">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Invoice
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-2xl font-semibold tracking-tight">
                {invoice.invoiceNumber}
              </h1>
              <StatusBadge status={overdue ? "overdue" : invoice.status} />
              {overdue && (
                <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
                  {daysLate} day{daysLate === 1 ? "" : "s"} late
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {invoice.status === "draft" && (
            <Button
              className="gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700"
              disabled={isActing}
              onClick={handleConfirm}
            >
              {isActing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Confirm
            </Button>
          )}

          {(invoice.status === "draft" || invoice.status === "confirmed") && (
            <Button
              variant="outline"
              className="gap-1.5"
              disabled={isActing}
              onClick={() => setSendOpen(true)}
            >
              <Send className="h-4 w-4" />
              Send
            </Button>
          )}

          {invoice.status === "confirmed" && (
            <Button
              className="gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700"
              onClick={() => setPaymentOpen(true)}
            >
              <CreditCard className="h-4 w-4" />
              Record payment
            </Button>
          )}

          {(invoice.status === "draft" || invoice.status === "confirmed") && (
            <Button
              variant="outline"
              className="gap-1.5 text-rose-600 hover:text-rose-700"
              disabled={isActing}
              onClick={() => setCancelOpen(true)}
            >
              <Ban className="h-4 w-4" />
              Cancel
            </Button>
          )}

          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" />
            Print / Download
          </Button>
        </div>
      </div>

      <div className="invoice-no-print">
        <InvoiceStepper status={invoice.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Invoice document */}
        <div
          id="invoice-document"
          className="rounded-xl border bg-card p-6 shadow-sm sm:p-10"
        >
          <div className="flex flex-col gap-6 border-b pb-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">
                B
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight">
                  {COMPANY.name}
                </p>
                <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
                  {COMPANY.address}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {COMPANY.email} · {COMPANY.phone}
                </p>
                <p className="text-xs text-muted-foreground">
                  GSTIN {COMPANY.gstin}
                </p>
              </div>
            </div>
            <div className="sm:text-right">
              <p className="text-2xl font-bold tracking-tight sm:text-3xl">
                INVOICE
              </p>
              <p className="mt-1 font-mono text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                {invoice.invoiceNumber}
              </p>
              <div className="mt-2">
                <StatusBadge status={overdue ? "overdue" : invoice.status} />
              </div>
            </div>
          </div>

          <div className="grid gap-6 border-b py-8 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Bill to
              </p>
              <p className="mt-1.5 text-sm font-semibold">
                {customer?.name ?? "Unknown customer"}
              </p>
              {customer?.companyName && (
                <p className="text-sm text-muted-foreground">
                  {customer.companyName}
                </p>
              )}
              {customer?.address && (
                <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted-foreground">
                  {customer.address}
                </p>
              )}
              {customer?.email && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {customer.email}
                </p>
              )}
              {customer?.gstNumber && (
                <p className="text-xs text-muted-foreground">
                  GSTIN {customer.gstNumber}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:justify-items-end">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Issue date
                </p>
                <p className="mt-0.5 font-medium">
                  {formatDate(invoice.issueDate)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Due date
                </p>
                <p
                  className={cn(
                    "mt-0.5 font-medium",
                    overdue && "text-rose-600 dark:text-rose-400",
                  )}
                >
                  {formatDate(invoice.dueDate)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Subscription
                </p>
                <Link
                  href={`/subscriptions/${invoice.subscriptionId}`}
                  className="mt-0.5 block font-mono text-xs font-medium text-indigo-600 underline-offset-4 hover:underline dark:text-indigo-400"
                >
                  {invoice.subscriptionNumber}
                </Link>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Payment terms
                </p>
                <p className="mt-0.5 font-medium">
                  {TERM_LABELS[invoice.paymentTerms ?? "immediate"] ??
                    "Due immediately"}
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto py-8">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit price</TableHead>
                  <TableHead className="text-right">Tax</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="text-sm">{line.description}</TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {line.quantity}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums">
                      {formatCurrency(line.unitPrice)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {line.taxRatePercent}%
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium tabular-nums">
                      {formatCurrency(line.lineTotal)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end border-t pt-6">
            <div className="w-full max-w-xs space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono tabular-nums">
                  {formatCurrency(invoice.subtotal)}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-muted-foreground">
                  Discount
                  {invoice.discountName && (
                    <span className="block text-xs">
                      {invoice.discountName}
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                  − {formatCurrency(invoice.discountTotal)}
                </span>
              </div>

              <div className="space-y-1.5 border-t pt-2.5">
                {taxGroups.length === 0 ? (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(invoice.taxTotal)}
                    </span>
                  </div>
                ) : (
                  taxGroups.map(([rate, value]) => (
                    <div
                      key={rate}
                      className="flex items-center justify-between"
                    >
                      <span className="text-muted-foreground">
                        GST {rate}%
                      </span>
                      <span className="font-mono tabular-nums">
                        {formatCurrency(value.tax * taxFactor)}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center justify-between border-t pt-2.5 text-base font-semibold">
                <span>Total</span>
                <span className="font-mono tabular-nums">
                  {formatCurrency(invoice.total)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Amount paid</span>
                <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                  − {formatCurrency(invoice.amountPaid)}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2.5 text-base font-bold">
                <span>Balance due</span>
                <span
                  className={cn(
                    "font-mono tabular-nums",
                    invoice.balance > 0 && overdue
                      ? "text-rose-600 dark:text-rose-400"
                      : "",
                  )}
                >
                  {formatCurrency(invoice.balance)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 border-t pt-4 text-xs text-muted-foreground">
            <p>
              Payment is due by {formatDate(invoice.dueDate)}. Please quote{" "}
              <span className="font-mono">{invoice.invoiceNumber}</span> with
              your payment. Thank you for choosing {COMPANY.name}.
            </p>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="invoice-no-print space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="h-4 w-4 text-emerald-600" />
                Payments received
              </CardTitle>
              <CardDescription>
                {payments.length === 0
                  ? "No payments recorded yet"
                  : `${payments.length} payment${
                      payments.length === 1 ? "" : "s"
                    } recorded`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {paymentsQuery.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : payments.length === 0 ? (
                <div className="rounded-lg border border-dashed p-5 text-center">
                  <Wallet className="mx-auto h-6 w-6 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium">No payments yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Payments against this invoice will appear here.
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {payments.map((payment) => (
                    <li
                      key={payment.id}
                      className="rounded-lg border bg-muted/20 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-mono text-sm font-semibold tabular-nums">
                            {formatCurrency(payment.amount)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {PAYMENT_METHOD_LABELS[payment.method]} ·{" "}
                            {formatDate(payment.paidAt)}
                          </p>
                        </div>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          Received
                        </span>
                      </div>
                      <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                        {payment.paymentReference}
                      </p>
                      {payment.notes && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {payment.notes}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-indigo-600" />
                Activity log
              </CardTitle>
              <CardDescription>
                Invoice lifecycle and payment events
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activityQuery.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : activity.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No activity recorded yet.
                </p>
              ) : (
                <ol className="relative ml-2 space-y-5 border-l border-border pl-5">
                  {activity.map((event, index) => {
                    const Icon = activityIcon(event);
                    return (
                      <li key={event.id} className="relative">
                        <span
                          className={cn(
                            "absolute -left-[33px] flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-background",
                            index === 0
                              ? "bg-indigo-600 text-white"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          <Icon className="h-2.5 w-2.5" />
                        </span>
                        <p className="text-sm font-medium">{event.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {event.actor} · {formatDateTime(event.createdAt)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatRelative(event.createdAt)}
                        </p>
                        {event.description && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {event.description}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Cancel confirmation */}
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel invoice"
        description={`Cancel ${invoice.invoiceNumber}? The customer will no longer be billed for this invoice.`}
        confirmLabel="Cancel invoice"
        cancelLabel="Keep invoice"
        variant="destructive"
        isLoading={isActing}
        onConfirm={handleCancel}
      />

      {/* Email preview */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send invoice</DialogTitle>
            <DialogDescription>
              Review the email before sending it to the billing contact.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-lg border bg-muted/20 p-4 text-sm">
            <div className="flex gap-2">
              <span className="w-16 shrink-0 text-muted-foreground">To</span>
              <span className="font-medium">
                {customer?.email ?? "billing contact"}
              </span>
            </div>
            <div className="flex gap-2">
              <span className="w-16 shrink-0 text-muted-foreground">
                Subject
              </span>
              <span className="font-medium">
                Invoice {invoice.invoiceNumber} from {COMPANY.name}
              </span>
            </div>
            <div className="border-t pt-3 text-sm leading-relaxed text-muted-foreground">
              <p>Hi {customer?.name ?? "there"},</p>
              <p className="mt-2">
                Please find invoice{" "}
                <span className="font-mono font-medium text-foreground">
                  {invoice.invoiceNumber}
                </span>{" "}
                for{" "}
                <span className="font-medium text-foreground">
                  {formatCurrency(invoice.total)}
                </span>
                , due on {formatDate(invoice.dueDate)}.
              </p>
              <p className="mt-2">
                You can view and pay this invoice from your billing portal.
                Please quote the invoice number with your payment.
              </p>
              <p className="mt-3">
                Thank you,
                <br />
                {COMPANY.name}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSendOpen(false)}
              disabled={isActing}
            >
              Cancel
            </Button>
            <Button
              className="gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700"
              onClick={handleSend}
              disabled={isActing}
            >
              {isActing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record payment */}
      <RecordPaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        invoice={invoice}
        onRecorded={async (result) => {
          await invalidate();
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["payments"] }),
            queryClient.invalidateQueries({
              queryKey: ["outstanding-invoices"],
            }),
          ]);
          if (result.invoice.status === "paid") {
            toast.success(`${result.invoice.invoiceNumber} is now fully paid`);
          }
        }}
      />
    </div>
  );
}
