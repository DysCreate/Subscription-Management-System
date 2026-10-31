"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertTriangle,
  Banknote,
  Bell,
  CalendarDays,
  CreditCard,
  Download,
  Loader2,
  Plus,
  Receipt,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { FilterBar } from "@/components/filter-bar";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  RecordPaymentDialog,
} from "@/features/payments/record-payment-dialog";
import {
  PAYMENT_METHOD_OPTIONS,
  PaymentMethodBadge,
} from "@/features/payments/payment-methods";
import { useAuth } from "@/hooks/use-auth";
import { getAllCustomers } from "@/lib/api/customers";
import {
  invoiceDaysLate,
  isInvoiceRecordOverdue,
  sendInvoiceReminder,
  type InvoiceRecord,
} from "@/lib/api/invoices";
import {
  getOutstandingInvoices,
  getPayments,
  type PaymentRecord,
  type PaymentStats,
} from "@/lib/api/payments";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Customer, ListQuery } from "@/types";

const PAGE_SIZE = 15;

const AVATAR_TONES = [
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
];

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function toneFor(value: string): string {
  const hash = value
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_TONES[hash % AVATAR_TONES.length] ?? AVATAR_TONES[0]!;
}

function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function PaymentsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const actor = user?.name ?? "Aarav Menon";

  const [tab, setTab] = React.useState<"payments" | "outstanding">("payments");
  const [search, setSearch] = React.useState("");
  const [method, setMethod] = React.useState("all");
  const [customerId, setCustomerId] = React.useState("all");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [isExporting, setIsExporting] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogInvoice, setDialogInvoice] =
    React.useState<InvoiceRecord | null>(null);
  const [sendingReminderId, setSendingReminderId] =
    React.useState<string | null>(null);

  const customersQuery = useQuery({
    queryKey: ["customers", "all"],
    queryFn: getAllCustomers,
  });

  const params: ListQuery = {
    page,
    pageSize: PAGE_SIZE,
    search: search.trim() || undefined,
    sortBy: "paidAt",
    sortOrder: "desc",
    filters: {
      method,
      customerId,
      dateFrom,
      dateTo,
    },
  };

  const paymentsQuery = useQuery({
    queryKey: ["payments", params],
    queryFn: () => getPayments(params),
    placeholderData: (previous) => previous,
  });

  const outstandingQuery = useQuery({
    queryKey: ["outstanding-invoices"],
    queryFn: getOutstandingInvoices,
  });

  const customers = React.useMemo<Customer[]>(
    () => customersQuery.data ?? [],
    [customersQuery.data],
  );
  const customerMap = React.useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );

  const stats: PaymentStats | undefined = paymentsQuery.data?.stats;
  const payments = paymentsQuery.data?.items ?? [];
  const outstanding = outstandingQuery.data ?? [];
  const total = paymentsQuery.data?.total ?? 0;
  const totalPages = paymentsQuery.data?.totalPages ?? 1;
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  const hasFilters =
    search.trim().length > 0 ||
    method !== "all" ||
    customerId !== "all" ||
    dateFrom.length > 0 ||
    dateTo.length > 0;

  const resetFilters = () => {
    setSearch("");
    setMethod("all");
    setCustomerId("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const openPaymentDialog = (invoice?: InvoiceRecord) => {
    setDialogInvoice(invoice ?? null);
    setDialogOpen(true);
  };

  const handleRecorded = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["payments"] }),
      queryClient.invalidateQueries({ queryKey: ["outstanding-invoices"] }),
      queryClient.invalidateQueries({ queryKey: ["invoices"] }),
    ]);
  };

  const handleSendReminder = async (invoice: InvoiceRecord) => {
    setSendingReminderId(invoice.id);
    try {
      await sendInvoiceReminder(invoice.id, actor);
      toast.success(`Payment reminder sent for ${invoice.invoiceNumber}`);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["outstanding-invoices"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["invoice", invoice.id],
        }),
      ]);
    } catch {
      toast.error("Could not send the payment reminder");
    } finally {
      setSendingReminderId(null);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await getPayments({
        page: 1,
        pageSize: 1000,
        search: search.trim() || undefined,
        sortBy: "paidAt",
        sortOrder: "desc",
        filters: { method, customerId, dateFrom, dateTo },
      });

      const rows: Array<Array<string | number>> = [
        [
          "Date",
          "Invoice",
          "Customer",
          "Company",
          "Method",
          "Amount",
          "Recorded by",
          "Reference",
          "Note",
        ],
        ...result.items.map((payment) => {
          const customer = customerMap.get(payment.customerId);
          return [
            formatDate(payment.paidAt),
            payment.invoiceNumber,
            customer?.name ?? "Unknown customer",
            customer?.companyName ?? "",
            PAYMENT_METHOD_OPTIONS.find(
              (option) => option.value === payment.method,
            )?.label ?? payment.method,
            payment.amount.toFixed(2),
            payment.recordedBy,
            payment.paymentReference,
            payment.notes ?? "",
          ];
        }),
      ];

      downloadCsv(
        `payments-${new Date().toISOString().slice(0, 10)}.csv`,
        rows,
      );
      toast.success(`Exported ${result.items.length} payments`);
    } catch {
      toast.error("Could not export payments");
    } finally {
      setIsExporting(false);
    }
  };

  const paymentColumns: ColumnDef<PaymentRecord>[] = [
    {
      accessorKey: "paidAt",
      header: "Date",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {formatDate(row.original.paidAt)}
        </span>
      ),
    },
    {
      accessorKey: "invoiceNumber",
      header: "Invoice",
      cell: ({ row }) => (
        <Link
          href={`/invoices/${row.original.invoiceId}`}
          onClick={(event) => event.stopPropagation()}
          className="whitespace-nowrap font-mono text-xs font-semibold text-indigo-600 underline-offset-4 hover:underline dark:text-indigo-400"
        >
          {row.original.invoiceNumber}
        </Link>
      ),
    },
    {
      id: "customer",
      accessorFn: (row) => customerMap.get(row.customerId)?.name ?? "",
      header: "Customer",
      cell: ({ row }) => {
        const customer = customerMap.get(row.original.customerId);
        const name = customer?.name ?? "Unknown customer";
        return (
          <div className="flex items-center gap-2.5">
            <Avatar className="h-7 w-7 border border-border/60">
              <AvatarFallback
                className={cn("text-[10px] font-semibold", toneFor(name))}
              >
                {initials(name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {name}
              </p>
              {customer?.companyName && (
                <p className="truncate text-xs text-muted-foreground">
                  {customer.companyName}
                </p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "method",
      header: "Method",
      cell: ({ row }) => <PaymentMethodBadge method={row.original.method} />,
    },
    {
      accessorKey: "amount",
      header: () => <span className="block text-right">Amount</span>,
      cell: ({ row }) => (
        <span className="block whitespace-nowrap text-right font-mono text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
          {formatCurrency(row.original.amount)}
        </span>
      ),
    },
    {
      accessorKey: "recordedBy",
      header: "Recorded by",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {row.original.recordedBy}
        </span>
      ),
    },
    {
      accessorKey: "notes",
      header: "Note",
      cell: ({ row }) => (
        <span
          className="block max-w-[200px] truncate text-sm text-muted-foreground"
          title={row.original.notes ?? ""}
        >
          {row.original.notes || "—"}
        </span>
      ),
    },
  ];

  const outstandingColumns: ColumnDef<InvoiceRecord>[] = [
    {
      accessorKey: "invoiceNumber",
      header: "Invoice no.",
      enableSorting: false,
      cell: ({ row }) => (
        <Link
          href={`/invoices/${row.original.id}`}
          onClick={(event) => event.stopPropagation()}
          className="whitespace-nowrap font-mono text-xs font-semibold text-indigo-600 underline-offset-4 hover:underline dark:text-indigo-400"
        >
          {row.original.invoiceNumber}
        </Link>
      ),
    },
    {
      id: "customer",
      accessorFn: (row) => customerMap.get(row.customerId)?.name ?? "",
      header: "Customer",
      enableSorting: false,
      cell: ({ row }) => {
        const customer = customerMap.get(row.original.customerId);
        const name = customer?.name ?? "Unknown customer";
        return (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {name}
            </p>
            {customer?.companyName && (
              <p className="truncate text-xs text-muted-foreground">
                {customer.companyName}
              </p>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "issueDate",
      header: "Issued",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {formatDate(row.original.issueDate)}
        </span>
      ),
    },
    {
      accessorKey: "dueDate",
      header: "Due date",
      enableSorting: false,
      cell: ({ row }) => {
        const late = invoiceDaysLate(row.original);
        return (
          <div className="whitespace-nowrap">
            <p
              className={cn(
                "text-sm",
                late > 0
                  ? "font-medium text-rose-600 dark:text-rose-400"
                  : "text-muted-foreground",
              )}
            >
              {formatDate(row.original.dueDate)}
            </p>
            {late > 0 ? (
              <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                {late} day{late === 1 ? "" : "s"} overdue
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">Not yet due</p>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "balance",
      header: () => <span className="block text-right">Balance</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <span className="block whitespace-nowrap text-right font-mono text-sm font-semibold tabular-nums">
          {formatCurrency(row.original.balance)}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      enableSorting: false,
      cell: ({ row }) =>
        isInvoiceRecordOverdue(row.original) ? (
          <StatusBadge status="overdue" />
        ) : (
          <StatusBadge status={row.original.status} />
        ),
    },
    {
      id: "actions",
      header: () => <span className="block text-right">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => {
        const invoice = row.original;
        const isSending = sendingReminderId === invoice.id;
        return (
          <div
            className="flex items-center justify-end gap-1.5"
            onClick={(event) => event.stopPropagation()}
          >
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2 text-xs"
              disabled={isSending}
              onClick={() => handleSendReminder(invoice)}
            >
              {isSending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Bell className="h-3 w-3" />
              )}
              Send reminder
            </Button>
            <Button
              size="sm"
              className="h-7 gap-1 bg-indigo-600 px-2 text-xs text-white hover:bg-indigo-700"
              onClick={() => openPaymentDialog(invoice)}
            >
              <CreditCard className="h-3 w-3" />
              Record payment
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Record collections, reconcile outstanding invoices, and chase overdue balances."
        actions={
          <>
            <Button
              variant="outline"
              className="gap-2"
              disabled={isExporting}
              onClick={handleExport}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export CSV
            </Button>
            <Button
              className="gap-2 bg-indigo-600 text-white hover:bg-indigo-700"
              onClick={() => openPaymentDialog()}
            >
              <Plus className="h-4 w-4" />
              Record Payment
            </Button>
          </>
        }
      />

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Collected this month"
          value={formatCurrency(stats?.collectedThisMonth ?? 0)}
          subtitle="Payment collections received"
          icon={Banknote}
          iconClassName="bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300"
        />
        <StatCard
          title="Outstanding"
          value={formatCurrency(stats?.outstanding ?? 0)}
          subtitle={`${stats?.outstandingCount ?? 0} open invoice${
            (stats?.outstandingCount ?? 0) === 1 ? "" : "s"
          }`}
          icon={Receipt}
          iconClassName="bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300"
        />
        <StatCard
          title="Overdue amount"
          value={formatCurrency(stats?.overdueAmount ?? 0)}
          subtitle={`${stats?.overdueCount ?? 0} invoice${
            (stats?.overdueCount ?? 0) === 1 ? "" : "s"
          } past due`}
          valueClassName="text-rose-600 dark:text-rose-400"
          subtitleClassName="font-medium text-rose-600 dark:text-rose-400"
          icon={AlertTriangle}
          iconClassName="bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300"
        />
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as "payments" | "outstanding")}
        className="space-y-4"
      >
        <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border bg-card p-1.5 shadow-sm">
          <TabsTrigger
            value="payments"
            className="gap-2 rounded-lg px-3 py-2 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm dark:data-[state=active]:bg-indigo-950/60 dark:data-[state=active]:text-indigo-300"
          >
            <Wallet className="h-4 w-4" />
            Payments
            <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
              {paymentsQuery.isLoading ? "…" : total}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="outstanding"
            className="gap-2 rounded-lg px-3 py-2 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-800 data-[state=active]:shadow-sm dark:data-[state=active]:bg-amber-950/50 dark:data-[state=active]:text-amber-300"
          >
            <AlertTriangle className="h-4 w-4" />
            Outstanding invoices
            <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
              {outstandingQuery.isLoading ? "…" : outstanding.length}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* Payments tab */}
        <TabsContent value="payments" className="mt-0 space-y-4">
          <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
            <FilterBar
              searchValue={search}
              onSearchChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              searchPlaceholder="Search invoice, customer, reference, note…"
              filters={[
                {
                  key: "method",
                  label: "Methods",
                  options: PAYMENT_METHOD_OPTIONS.map((option) => ({
                    label: option.label,
                    value: option.value,
                  })),
                },
                {
                  key: "customerId",
                  label: "Customers",
                  options: customers.map((customer) => ({
                    label: customer.name,
                    value: customer.id,
                  })),
                },
              ]}
              filterValues={{ method, customerId }}
              onFilterChange={(key, value) => {
                if (key === "method") setMethod(value);
                if (key === "customerId") setCustomerId(value);
                setPage(1);
              }}
              onReset={resetFilters}
            />

            <div className="flex flex-col gap-3 border-t border-border/60 pt-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                Payment date range
              </div>
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <Input
                  type="date"
                  aria-label="Payment date from"
                  value={dateFrom}
                  onChange={(event) => {
                    setDateFrom(event.target.value);
                    setPage(1);
                  }}
                  className="h-8 w-[150px] text-xs"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="date"
                  aria-label="Payment date to"
                  value={dateTo}
                  onChange={(event) => {
                    setDateTo(event.target.value);
                    setPage(1);
                  }}
                  className="h-8 w-[150px] text-xs"
                />
                {(dateFrom || dateTo) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-xs text-muted-foreground"
                    onClick={() => {
                      setDateFrom("");
                      setDateTo("");
                      setPage(1);
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                    Clear dates
                  </Button>
                )}
              </div>
              <span className="ml-auto text-xs text-muted-foreground">
                {paymentsQuery.isFetching && !paymentsQuery.isLoading ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" />
                    Updating…
                  </span>
                ) : (
                  `${total} payment${total === 1 ? "" : "s"}`
                )}
              </span>
            </div>
          </div>

          {paymentsQuery.error ? (
            <ErrorState
              title="Could not load payments"
              message="The payment ledger could not be retrieved. Check your connection and try again."
              onRetry={() => paymentsQuery.refetch()}
            />
          ) : !paymentsQuery.isLoading && total === 0 ? (
            <div className="rounded-xl border bg-card">
              <EmptyState
                icon={Wallet}
                title={hasFilters ? "No matching payments" : "No payments yet"}
                description={
                  hasFilters
                    ? "No payments match the current method, customer or date filters. Try broadening the criteria."
                    : "Record a payment against an outstanding invoice to start building the collection ledger."
                }
                actionLabel={hasFilters ? "Clear filters" : "Record payment"}
                onAction={() =>
                  hasFilters ? resetFilters() : openPaymentDialog()
                }
              />
            </div>
          ) : (
            <>
              <DataTable
                columns={paymentColumns}
                data={payments}
                isLoading={paymentsQuery.isLoading}
                skeletonRows={PAGE_SIZE}
                className="overflow-x-auto"
              />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Showing{" "}
                  <span className="font-medium text-foreground">{from}</span>–
                  <span className="font-medium text-foreground">{to}</span> of{" "}
                  <span className="font-medium text-foreground">{total}</span>{" "}
                  payments
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(Math.max(page - 1, 1))}
                  >
                    Previous
                  </Button>
                  {Array.from({ length: totalPages }).map((_, index) => {
                    const pageNumber = index + 1;
                    return (
                      <Button
                        key={pageNumber}
                        variant={pageNumber === page ? "default" : "ghost"}
                        size="sm"
                        className={cn(
                          "min-w-9",
                          pageNumber === page &&
                            "bg-indigo-600 text-white hover:bg-indigo-700",
                        )}
                        onClick={() => setPage(pageNumber)}
                        aria-current={
                          pageNumber === page ? "page" : undefined
                        }
                      >
                        {pageNumber}
                      </Button>
                    );
                  })}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(Math.min(page + 1, totalPages))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </TabsContent>

        {/* Outstanding invoices tab */}
        <TabsContent value="outstanding" className="mt-0 space-y-4">
          <div className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Collections worklist</p>
              <p className="text-xs text-muted-foreground">
                Unpaid and overdue invoices, sorted by days overdue. Send a
                reminder or record a payment inline.
              </p>
            </div>
            <p className="text-xs font-medium text-muted-foreground">
              {outstandingQuery.isLoading
                ? "Loading…"
                : `${outstanding.length} invoice${
                    outstanding.length === 1 ? "" : "s"
                  } · ${formatCurrency(stats?.outstanding ?? 0)} outstanding`}
            </p>
          </div>

          {outstandingQuery.error ? (
            <ErrorState
              title="Could not load the worklist"
              message="Outstanding invoices could not be retrieved. Try again."
              onRetry={() => outstandingQuery.refetch()}
            />
          ) : !outstandingQuery.isLoading && outstanding.length === 0 ? (
            <div className="rounded-xl border bg-card">
              <EmptyState
                icon={Receipt}
                title="No outstanding invoices"
                description="Every confirmed invoice has been paid. New confirmed invoices will show up here automatically."
              />
            </div>
          ) : (
            <DataTable
              columns={outstandingColumns}
              data={outstanding}
              isLoading={outstandingQuery.isLoading}
              skeletonRows={8}
              onRowClick={(row) => router.push(`/invoices/${row.id}`)}
              className="overflow-x-auto"
            />
          )}
        </TabsContent>
      </Tabs>

      <RecordPaymentDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setDialogInvoice(null);
        }}
        invoice={dialogInvoice}
        onRecorded={handleRecorded}
      />
    </div>
  );
}
