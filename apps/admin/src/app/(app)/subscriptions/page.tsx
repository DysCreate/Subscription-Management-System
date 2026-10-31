"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Ban,
  CalendarDays,
  CheckCircle2,
  Copy,
  Eye,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  Plus,
  Repeat,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { FilterBar } from "@/components/filter-bar";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { StatusBadge } from "@/components/status-badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, formatDate } from "@/lib/format";
import { getAllCustomers } from "@/lib/api/customers";
import { getPlans } from "@/lib/api/plans";
import { getProducts } from "@/lib/api/products";
import {
  calculateSubscriptionTotal,
  deleteSubscription,
  duplicateSubscription,
  getSubscriptions,
  resolveSubscriptionPlans,
  updateSubscriptionStatus,
} from "@/lib/api/subscriptions";
import type {
  Customer,
  ListQuery,
  Product,
  Plan,
  Subscription,
  SubscriptionStatus,
} from "@/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

const TABS: Array<{ key: "all" | SubscriptionStatus; label: string }> = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "quotation", label: "Quotation" },
  { key: "confirmed", label: "Confirmed" },
  { key: "active", label: "Active" },
  { key: "closed", label: "Closed" },
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
  const hash = value.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_TONES[hash % AVATAR_TONES.length] ?? AVATAR_TONES[0]!;
}

export default function SubscriptionsPage() {
  const router = useRouter();
  const { isAdmin } = useAuth();

  const [status, setStatus] = React.useState<"all" | SubscriptionStatus>("all");
  const [search, setSearch] = React.useState("");
  const [planId, setPlanId] = React.useState("all");
  const [customerId, setCustomerId] = React.useState("all");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [actioningId, setActioningId] = React.useState<string | null>(null);

  const customersQuery = useQuery({
    queryKey: ["customers", "all"],
    queryFn: getAllCustomers,
  });
  const plansQuery = useQuery({
    queryKey: ["plans", "all"],
    queryFn: () => getPlans({ pageSize: 100 }),
  });
  const productsQuery = useQuery({
    queryKey: ["products", "all"],
    queryFn: () => getProducts({ pageSize: 100 }),
  });

  const params: ListQuery = {
    page,
    pageSize: PAGE_SIZE,
    search: search.trim() || undefined,
    sortBy: "createdAt",
    sortOrder: "desc",
    filters: {
      status,
      planId,
      customerId,
      dateFrom,
      dateTo,
    },
  };

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["subscriptions", params],
    queryFn: () => getSubscriptions(params),
    placeholderData: (previous) => previous,
  });

  const customers = React.useMemo<Customer[]>(
    () => customersQuery.data ?? [],
    [customersQuery.data],
  );
  const plans = React.useMemo<Plan[]>(
    () => plansQuery.data?.items ?? [],
    [plansQuery.data],
  );
  const products = React.useMemo<Product[]>(
    () => productsQuery.data?.items ?? [],
    [productsQuery.data],
  );

  const customerMap = React.useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );
  const counts = data?.statusCounts;
  const allCount = counts
    ? counts.draft + counts.quotation + counts.confirmed + counts.active + counts.closed
    : 0;

  const hasFilters =
    search.trim().length > 0 ||
    planId !== "all" ||
    customerId !== "all" ||
    dateFrom.length > 0 ||
    dateTo.length > 0;

  const resetFilters = () => {
    setSearch("");
    setPlanId("all");
    setCustomerId("all");
    setDateFrom("");
    setDateTo("");
    setStatus("all");
    setPage(1);
  };

  const changeStatus = (next: "all" | SubscriptionStatus) => {
    setStatus(next);
    setPage(1);
  };

  const runStatusAction = async (
    subscription: Subscription,
    next: SubscriptionStatus,
    successMessage: string,
  ) => {
    try {
      setActioningId(subscription.id);
      await updateSubscriptionStatus(subscription.id, next);
      toast.success(successMessage);
      await refetch();
    } catch {
      toast.error("Could not update the subscription status");
    } finally {
      setActioningId(null);
    }
  };

  const handleDuplicate = async (subscription: Subscription) => {
    try {
      setActioningId(subscription.id);
      const duplicate = await duplicateSubscription(subscription.id);
      toast.success(`${duplicate.subscriptionNumber} created as a draft`);
      await refetch();
    } catch {
      toast.error("Could not duplicate the subscription");
    } finally {
      setActioningId(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      setIsDeleting(true);
      await deleteSubscription(deletingId);
      toast.success("Subscription deleted");
      setDeletingId(null);
      await refetch();
    } catch {
      toast.error("Failed to delete the subscription");
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: ColumnDef<Subscription>[] = [
    {
      accessorKey: "subscriptionNumber",
      header: "Number",
      cell: ({ row }) => (
        <Link
          href={`/subscriptions/${row.original.id}`}
          onClick={(event) => event.stopPropagation()}
          className="font-mono text-xs font-semibold text-indigo-600 underline-offset-4 hover:underline dark:text-indigo-400"
        >
          {row.original.subscriptionNumber}
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
              <p className="truncate text-sm font-medium text-foreground">{name}</p>
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
      id: "plan",
      accessorFn: (row) => resolveSubscriptionPlans(row, plans, products),
      header: "Plan",
      cell: ({ row }) => (
        <span className="text-sm text-foreground">
          {resolveSubscriptionPlans(row.original, plans, products)}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "startDate",
      header: "Start date",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {formatDate(row.original.startDate)}
        </span>
      ),
    },
    {
      accessorKey: "endDate",
      header: "Expiry date",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {row.original.endDate ? formatDate(row.original.endDate) : "—"}
        </span>
      ),
    },
    {
      accessorKey: "nextBillingDate",
      header: "Next billing",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {row.original.nextBillingDate
            ? formatDate(row.original.nextBillingDate)
            : "—"}
        </span>
      ),
    },
    {
      id: "total",
      accessorFn: (row) => calculateSubscriptionTotal(row),
      header: "Amount / cycle",
      cell: ({ row }) => (
        <span className="whitespace-nowrap font-mono text-sm font-semibold tabular-nums text-foreground">
          {formatCurrency(calculateSubscriptionTotal(row.original))}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;
        const isBusy = actioningId === item.id;

        return (
          <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  disabled={isBusy}
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {item.status}
                </DropdownMenuLabel>
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  onClick={() => router.push(`/subscriptions/${item.id}`)}
                >
                  <Eye className="h-3.5 w-3.5" />
                  View details
                </DropdownMenuItem>

                {item.status === "draft" && (
                  <DropdownMenuItem
                    className="cursor-pointer gap-2"
                    onClick={() =>
                      runStatusAction(
                        item,
                        "quotation",
                        `${item.subscriptionNumber} sent as quotation`,
                      )
                    }
                  >
                    <Send className="h-3.5 w-3.5" />
                    Send quotation
                  </DropdownMenuItem>
                )}

                {item.status === "quotation" && (
                  <DropdownMenuItem
                    className="cursor-pointer gap-2"
                    onClick={() =>
                      runStatusAction(
                        item,
                        "confirmed",
                        `${item.subscriptionNumber} confirmed`,
                      )
                    }
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Confirm subscription
                  </DropdownMenuItem>
                )}

                {item.status === "confirmed" && (
                  <DropdownMenuItem
                    className="cursor-pointer gap-2"
                    onClick={() =>
                      runStatusAction(
                        item,
                        "active",
                        `${item.subscriptionNumber} activated`,
                      )
                    }
                  >
                    <PlayCircle className="h-3.5 w-3.5" />
                    Activate
                  </DropdownMenuItem>
                )}

                {item.status === "active" && (
                  <DropdownMenuItem
                    className="cursor-pointer gap-2"
                    onClick={() =>
                      runStatusAction(
                        item,
                        "paused",
                        `${item.subscriptionNumber} paused`,
                      )
                    }
                  >
                    <PauseCircle className="h-3.5 w-3.5" />
                    Pause billing
                  </DropdownMenuItem>
                )}

                {(item.status === "confirmed" || item.status === "active") && (
                  <DropdownMenuItem
                    className="cursor-pointer gap-2"
                    onClick={() =>
                      runStatusAction(
                        item,
                        "closed",
                        `${item.subscriptionNumber} closed`,
                      )
                    }
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Close subscription
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  onClick={() => handleDuplicate(item)}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Duplicate as draft
                </DropdownMenuItem>

                {isAdmin && (
                  <DropdownMenuItem
                    className="cursor-pointer gap-2 text-rose-600 focus:bg-rose-50 focus:text-rose-600 dark:focus:bg-rose-950/40"
                    onClick={() => setDeletingId(item.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
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
        title="Subscriptions"
        description="Track every customer subscription from quotation to renewal across the full billing lifecycle."
        actions={
          <Button
            asChild
            className="gap-2 bg-indigo-600 text-white hover:bg-indigo-700"
          >
            <Link href="/subscriptions/new">
              <Plus className="h-4 w-4" />
              New subscription
            </Link>
          </Button>
        }
      />

      {/* Status tabs */}
      <div
        role="tablist"
        aria-label="Filter subscriptions by status"
        className="flex gap-1 overflow-x-auto rounded-xl border bg-card p-1.5 shadow-sm"
      >
        {TABS.map((tab) => {
          const isActive = status === tab.key;
          const count =
            tab.key === "all"
              ? allCount
              : counts
                ? counts[tab.key]
                : 0;
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
                    ? "bg-indigo-600 text-white"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {isLoading && !data ? "…" : count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
        <FilterBar
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          searchPlaceholder="Search number, customer, plan…"
          filters={[
            {
              key: "planId",
              label: "Plans",
              options: plans.map((plan) => ({ label: plan.name, value: plan.id })),
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
          filterValues={{ planId, customerId }}
          onFilterChange={(key, value) => {
            if (key === "planId") setPlanId(value);
            if (key === "customerId") setCustomerId(value);
            setPage(1);
          }}
          onReset={resetFilters}
        />

        <div className="flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            Start date range
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <Input
              type="date"
              aria-label="Start date from"
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
              aria-label="Start date to"
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
            {isFetching && !isLoading ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" />
                Updating…
              </span>
            ) : (
              `${total} subscription${total === 1 ? "" : "s"}`
            )}
          </span>
        </div>
      </div>

      {error ? (
        <ErrorState
          title="Could not load subscriptions"
          message="The subscription ledger could not be retrieved. Check your connection and try again."
          onRetry={() => refetch()}
        />
      ) : isEmpty ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={Repeat}
            title={hasFilters ? "No matching subscriptions" : "No subscriptions yet"}
            description={
              hasFilters
                ? "No subscriptions match the current status, search or date filters. Try broadening the criteria."
                : "Create your first subscription to start recurring billing for a customer."
            }
            actionLabel={hasFilters ? "Clear filters" : "Create subscription"}
            onAction={() =>
              hasFilters ? resetFilters() : router.push("/subscriptions/new")
            }
          />
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            isLoading={isLoading}
            skeletonRows={PAGE_SIZE}
            onRowClick={(row) => router.push(`/subscriptions/${row.id}`)}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Showing <span className="font-medium text-foreground">{from}</span>–
              <span className="font-medium text-foreground">{to}</span> of{" "}
              <span className="font-medium text-foreground">{total}</span>{" "}
              subscriptions
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
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
                onClick={() =>
                  setPage((current) => Math.min(current + 1, totalPages))
                }
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(deletingId)}
        onOpenChange={(open) => !open && setDeletingId(null)}
        title="Delete subscription"
        description="This removes the subscription and its order lines from the mock ledger. This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
