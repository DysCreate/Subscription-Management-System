"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Download,
  Loader2,
  PlayCircle,
  Receipt,
  Send,
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, formatDate } from "@/lib/format";
import { getAllCustomers } from "@/lib/api/customers";
import {
  confirmInvoices,
  getInvoices,
  invoiceDaysLate,
  isInvoiceRecordOverdue,
  runBilling,
  sendInvoices,
  type BillingRunResult,
  type InvoiceRecord,
  type InvoiceTabStatus,
} from "@/lib/api/invoices";
import type { Customer, ListQuery } from "@/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 15;

const TABS: Array<{ key: InvoiceTabStatus; label: string }> = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "confirmed", label: "Confirmed" },
  { key: "paid", label: "Paid" },
  { key: "overdue", label: "Overdue" },
  { key: "cancelled", label: "Cancelled" },
];

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

export default function InvoicesPage() {
  const router = useRouter();
  const { isAdmin } = useAuth();

  const [status, setStatus] = React.useState<InvoiceTabStatus>("all");
  const [search, setSearch] = React.useState("");
  const [customerId, setCustomerId] = React.useState("all");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [isBulkActing, setIsBulkActing] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);

  const [billingOpen, setBillingOpen] = React.useState(false);
  const [billingState, setBillingState] = React.useState<
    "idle" | "running" | "done"
  >("idle");
  const [billingProgress, setBillingProgress] = React.useState(0);
  const [billingResult, setBillingResult] =
    React.useState<BillingRunResult | null>(null);
  const progressTimer = React.useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  React.useEffect(() => {
    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, []);

  const customersQuery = useQuery({
    queryKey: ["customers", "all"],
    queryFn: getAllCustomers,
  });

  const overdueOnly = status === "overdue";

  const params: ListQuery = {
    page,
    pageSize: PAGE_SIZE,
    search: search.trim() || undefined,
    sortBy: "issueDate",
    sortOrder: "desc",
    filters: {
      status,
      customerId,
      dateFrom,
      dateTo,
    },
  };

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["invoices", params],
    queryFn: () => getInvoices(params),
    placeholderData: (previous) => previous,
  });

  const customers = React.useMemo<Customer[]>(
    () => customersQuery.data ?? [],
    [customersQuery.data],
  );
  const customerMap = React.useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );

  const counts = data?.statusCounts;
  const stats = data?.stats;

  const hasFilters =
    search.trim().length > 0 ||
    customerId !== "all" ||
    dateFrom.length > 0 ||
    dateTo.length > 0 ||
    status !== "all";

  const changeStatus = (next: InvoiceTabStatus) => {
    setStatus(next);
    setPage(1);
    setSelected(new Set());
  };

  const resetFilters = () => {
    setSearch("");
    setCustomerId("all");
    setDateFrom("");
    setDateTo("");
    setStatus("all");
    setPage(1);
    setSelected(new Set());
  };

  const goToPage = (next: number) => {
    setPage(next);
    setSelected(new Set());
  };

  const pageItems = data?.items ?? [];
  const allPageSelected =
    pageItems.length > 0 &&
    pageItems.every((invoice) => selected.has(invoice.id));
  const somePageSelected = pageItems.some((invoice) =>
    selected.has(invoice.id),
  );

  const toggleAllOnPage = (checked: boolean) => {
    setSelected((previous) => {
      const next = new Set(previous);
      pageItems.forEach((invoice) => {
        if (checked) next.add(invoice.id);
        else next.delete(invoice.id);
      });
      return next;
    });
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleBulkSend = async () => {
    if (selected.size === 0) return;
    setIsBulkActing(true);
    try {
      const result = await sendInvoices([...selected]);
      toast.success(
        `${result.updated} invoice${result.updated === 1 ? "" : "s"} sent${
          result.skipped > 0 ? ` · ${result.skipped} skipped` : ""
        }`,
      );
      setSelected(new Set());
      await refetch();
    } catch {
      toast.error("Could not send the selected invoices");
    } finally {
      setIsBulkActing(false);
    }
  };

  const handleBulkConfirm = async () => {
    if (selected.size === 0) return;
    setIsBulkActing(true);
    try {
      const result = await confirmInvoices([...selected]);
      toast.success(
        `${result.updated} invoice${result.updated === 1 ? "" : "s"} confirmed${
          result.skipped > 0 ? ` · ${result.skipped} skipped` : ""
        }`,
      );
      setSelected(new Set());
      await refetch();
    } catch {
      toast.error("Could not confirm the selected invoices");
    } finally {
      setIsBulkActing(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await getInvoices({
        page: 1,
        pageSize: 1000,
        search: search.trim() || undefined,
        sortBy: "issueDate",
        sortOrder: "desc",
        filters: { status, customerId, dateFrom, dateTo },
      });

      const header = [
        "Invoice number",
        "Customer",
        "Company",
        "Subscription",
        "Issue date",
        "Due date",
        "Total",
        "Amount paid",
        "Balance",
        "Status",
      ];
      const rows = result.items.map((invoice) => {
        const customer = customerMap.get(invoice.customerId);
        return [
          invoice.invoiceNumber,
          customer?.name ?? "Unknown customer",
          customer?.companyName ?? "",
          invoice.subscriptionNumber,
          formatDate(invoice.issueDate),
          formatDate(invoice.dueDate),
          invoice.total.toFixed(2),
          invoice.amountPaid.toFixed(2),
          invoice.balance.toFixed(2),
          isInvoiceRecordOverdue(invoice) ? "overdue" : invoice.status,
        ];
      });
      const csv = [header, ...rows]
        .map((row) => row.map(csvCell).join(","))
        .join("\n");

      const blob = new Blob([`\ufeff${csv}`], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${result.items.length} invoices`);
    } catch {
      toast.error("Could not export invoices");
    } finally {
      setIsExporting(false);
    }
  };

  const startBilling = async () => {
    setBillingState("running");
    setBillingProgress(5);
    setBillingResult(null);

    progressTimer.current = setInterval(() => {
      setBillingProgress((current) => Math.min(current + 7, 90));
    }, 180);

    try {
      const result = await runBilling();
      if (progressTimer.current) clearInterval(progressTimer.current);
      progressTimer.current = null;
      setBillingProgress(100);
      setBillingResult(result);
      setBillingState("done");
      toast.success(
        `Billing run complete — ${result.created} invoice${
          result.created === 1 ? "" : "s"
        } created`,
      );
      await refetch();
    } catch {
      if (progressTimer.current) clearInterval(progressTimer.current);
      progressTimer.current = null;
      setBillingState("idle");
      setBillingProgress(0);
      toast.error("Billing run failed");
    }
  };

  const closeBillingDialog = () => {
    if (progressTimer.current) clearInterval(progressTimer.current);
    progressTimer.current = null;
    setBillingOpen(false);
    setBillingState("idle");
    setBillingProgress(0);
    setBillingResult(null);
  };

  const columns: ColumnDef<InvoiceRecord>[] = [
    {
      id: "select",
      header: () => (
        <Checkbox
          checked={
            allPageSelected
              ? true
              : somePageSelected
                ? "indeterminate"
                : false
          }
          onCheckedChange={(checked) => toggleAllOnPage(checked === true)}
          onClick={(event) => event.stopPropagation()}
          aria-label="Select all invoices on this page"
        />
      ),
      cell: ({ row }) => (
        <div onClick={(event) => event.stopPropagation()}>
          <Checkbox
            checked={selected.has(row.original.id)}
            onCheckedChange={(checked) =>
              toggleOne(row.original.id, checked === true)
            }
            aria-label={`Select ${row.original.invoiceNumber}`}
          />
        </div>
      ),
      enableSorting: false,
    },
    {
      accessorKey: "invoiceNumber",
      header: "Invoice no.",
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
      cell: ({ row }) => {
        const customer = customerMap.get(row.original.customerId);
        const name = customer?.name ?? "Unknown customer";
        return (
          <div className="flex items-center gap-2.5">
            <Avatar className="h-8 w-8 border border-border/60">
              <AvatarFallback
                className={cn("text-[11px] font-semibold", toneFor(name))}
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
      id: "subscription",
      accessorFn: (row) => row.subscriptionNumber,
      header: "Subscription",
      cell: ({ row }) => (
        <Link
          href={`/subscriptions/${row.original.subscriptionId}`}
          onClick={(event) => event.stopPropagation()}
          className="whitespace-nowrap font-mono text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {row.original.subscriptionNumber}
        </Link>
      ),
    },
    {
      accessorKey: "issueDate",
      header: "Issue date",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {formatDate(row.original.issueDate)}
        </span>
      ),
    },
    {
      accessorKey: "dueDate",
      header: "Due date",
      cell: ({ row }) => {
        const invoice = row.original;
        const late = invoiceDaysLate(invoice);
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
              {formatDate(invoice.dueDate)}
            </p>
            {late > 0 && (
              <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                {late} day{late === 1 ? "" : "s"} late
              </p>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "total",
      header: () => <span className="block text-right">Total</span>,
      cell: ({ row }) => (
        <span className="block whitespace-nowrap text-right font-mono text-sm font-semibold tabular-nums">
          {formatCurrency(row.original.total)}
        </span>
      ),
    },
    {
      accessorKey: "amountPaid",
      header: () => <span className="block text-right">Amount paid</span>,
      cell: ({ row }) => (
        <span
          className={cn(
            "block whitespace-nowrap text-right font-mono text-sm tabular-nums",
            row.original.amountPaid > 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-muted-foreground",
          )}
        >
          {formatCurrency(row.original.amountPaid)}
        </span>
      ),
    },
    {
      accessorKey: "balance",
      header: () => <span className="block text-right">Balance</span>,
      cell: ({ row }) => (
        <span
          className={cn(
            "block whitespace-nowrap text-right font-mono text-sm tabular-nums",
            row.original.balance > 0 ? "font-medium" : "text-muted-foreground",
          )}
        >
          {formatCurrency(row.original.balance)}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) =>
        isInvoiceRecordOverdue(row.original) ? (
          <StatusBadge status="overdue" />
        ) : (
          <StatusBadge status={row.original.status} />
        ),
    },
  ];

  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const isEmpty = !isLoading && total === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Track draft, confirmed, paid, and overdue invoices generated from recurring subscriptions."
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
            {isAdmin && (
              <Button
                className="gap-2 bg-indigo-600 text-white hover:bg-indigo-700"
                onClick={() => {
                  setBillingOpen(true);
                  setBillingState("idle");
                  setBillingProgress(0);
                  setBillingResult(null);
                }}
              >
                <PlayCircle className="h-4 w-4" />
                Run billing now
              </Button>
            )}
          </>
        }
      />

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total outstanding"
          value={formatCurrency(stats?.totalOutstanding ?? 0)}
          subtitle={`${stats?.outstandingCount ?? 0} open confirmed invoice${
            (stats?.outstandingCount ?? 0) === 1 ? "" : "s"
          }`}
          icon={Wallet}
          iconClassName="bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300"
        />
        <StatCard
          title="Overdue"
          value={formatCurrency(stats?.overdueAmount ?? 0)}
          subtitle={`${stats?.overdueCount ?? 0} invoice${
            (stats?.overdueCount ?? 0) === 1 ? "" : "s"
          } past due`}
          valueClassName="text-rose-600 dark:text-rose-400"
          subtitleClassName="font-medium text-rose-600 dark:text-rose-400"
          icon={AlertTriangle}
          iconClassName="bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300"
        />
        <StatCard
          title="Paid this month"
          value={formatCurrency(stats?.paidThisMonth ?? 0)}
          subtitle="Collections received"
          icon={CheckCircle2}
          iconClassName="bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300"
        />
        <StatCard
          title="Draft"
          value={String(stats?.draftCount ?? 0)}
          subtitle="Awaiting confirmation"
          icon={Receipt}
          iconClassName="bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300"
        />
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Filter invoices by status"
        className="flex gap-1 overflow-x-auto rounded-xl border bg-card p-1.5 shadow-sm"
      >
        {TABS.map((tab) => {
          const isActive = status === tab.key;
          const count = counts ? counts[tab.key] : 0;
          return (
            <button
              key={tab.key}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => changeStatus(tab.key)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 dark:ring-indigo-900"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "inline-flex min-w-[22px] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                  isActive
                    ? tab.key === "overdue"
                      ? "bg-rose-600 text-white"
                      : "bg-indigo-600 text-white"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {isLoading && !data ? "…" : count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
        <FilterBar
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
            setSelected(new Set());
          }}
          searchPlaceholder="Search invoice, customer, subscription…"
          filters={[
            {
              key: "status",
              label: "Statuses",
              options: TABS.filter((tab) => tab.key !== "all").map((tab) => ({
                label: tab.label,
                value: tab.key,
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
          filterValues={{ status, customerId }}
          onFilterChange={(key, value) => {
            if (key === "status") changeStatus(value as InvoiceTabStatus);
            if (key === "customerId") {
              setCustomerId(value);
              setPage(1);
              setSelected(new Set());
            }
          }}
          onReset={resetFilters}
        />

        <div className="flex flex-col gap-3 border-t border-border/60 pt-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            Issue date range
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <Input
              type="date"
              aria-label="Issue date from"
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
              aria-label="Issue date to"
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

          <div className="flex items-center gap-2">
            <Switch
              id="overdue-only"
              checked={overdueOnly}
              onCheckedChange={(checked) =>
                changeStatus(checked ? "overdue" : "all")
              }
            />
            <Label
              htmlFor="overdue-only"
              className="text-xs font-medium text-muted-foreground"
            >
              Overdue only
            </Label>
          </div>

          <span className="ml-auto text-xs text-muted-foreground">
            {isFetching && !isLoading ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" />
                Updating…
              </span>
            ) : (
              `${total} invoice${total === 1 ? "" : "s"}`
            )}
          </span>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-3 dark:border-indigo-900 dark:bg-indigo-950/40">
          <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200">
            {selected.size} selected
          </p>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={isBulkActing}
              onClick={handleBulkSend}
            >
              {isBulkActing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Send selected
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700"
              disabled={isBulkActing}
              onClick={handleBulkConfirm}
            >
              {isBulkActing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Confirm selected
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelected(new Set())}
              disabled={isBulkActing}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {error ? (
        <ErrorState
          title="Could not load invoices"
          message="The invoice ledger could not be retrieved. Check your connection and try again."
          onRetry={() => refetch()}
        />
      ) : isEmpty ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={Receipt}
            title={hasFilters ? "No matching invoices" : "No invoices yet"}
            description={
              hasFilters
                ? "No invoices match the current status, search or date filters. Try broadening the criteria."
                : "Run billing from an active subscription to generate your first invoice."
            }
            actionLabel={hasFilters ? "Clear filters" : "Run billing now"}
            onAction={() =>
              hasFilters ? resetFilters() : setBillingOpen(true)
            }
          />
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={pageItems}
            isLoading={isLoading}
            skeletonRows={PAGE_SIZE}
            onRowClick={(row) => router.push(`/invoices/${row.id}`)}
            className="overflow-x-auto"
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Showing{" "}
              <span className="font-medium text-foreground">{from}</span>–
              <span className="font-medium text-foreground">{to}</span> of{" "}
              <span className="font-medium text-foreground">{total}</span>{" "}
              invoices
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => goToPage(Math.max(page - 1, 1))}
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
                    onClick={() => goToPage(pageNumber)}
                    aria-current={pageNumber === page ? "page" : undefined}
                  >
                    {pageNumber}
                  </Button>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => goToPage(Math.min(page + 1, totalPages))}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Billing run dialog */}
      <Dialog
        open={billingOpen}
        onOpenChange={(open) => {
          if (!open) closeBillingDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run billing now</DialogTitle>
            <DialogDescription>
              Generate invoices for active subscriptions that are due for their
              next billing cycle. This simulates the scheduled billing job.
            </DialogDescription>
          </DialogHeader>

          {billingState === "idle" ? (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                The billing engine will:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>Create invoices for active subscriptions due today</li>
                <li>Skip subscriptions that already have an invoice today</li>
                <li>Report any invoices that could not be generated</li>
              </ul>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {billingState === "running"
                      ? "Processing subscriptions…"
                      : "Billing run complete"}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {billingProgress}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                    style={{ width: `${billingProgress}%` }}
                  />
                </div>
              </div>

              {billingState === "done" && billingResult && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border bg-emerald-50 p-3 text-center dark:bg-emerald-950/40">
                      <p className="text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                        {billingResult.created}
                      </p>
                      <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        Created
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/40 p-3 text-center">
                      <p className="text-2xl font-semibold tabular-nums">
                        {billingResult.skipped}
                      </p>
                      <p className="text-xs font-medium text-muted-foreground">
                        Skipped
                      </p>
                    </div>
                    <div className="rounded-lg border bg-rose-50 p-3 text-center dark:bg-rose-950/40">
                      <p className="text-2xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                        {billingResult.failed}
                      </p>
                      <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                        Failed
                      </p>
                    </div>
                  </div>
                  {billingResult.invoiceNumbers.length > 0 && (
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        New invoices
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {billingResult.invoiceNumbers.slice(0, 8).map((number) => (
                          <span
                            key={number}
                            className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                          >
                            {number}
                          </span>
                        ))}
                        {billingResult.invoiceNumbers.length > 8 && (
                          <span className="px-1.5 py-0.5 text-[11px] text-muted-foreground">
                            +{billingResult.invoiceNumbers.length - 8} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <DialogFooter>
            {billingState === "idle" ? (
              <>
                <Button variant="outline" onClick={closeBillingDialog}>
                  Cancel
                </Button>
                <Button
                  className="gap-2 bg-indigo-600 text-white hover:bg-indigo-700"
                  onClick={startBilling}
                >
                  <PlayCircle className="h-4 w-4" />
                  Start billing
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                onClick={closeBillingDialog}
                disabled={billingState === "running"}
              >
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
