"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  CalendarRange,
  Clock,
  Edit,
  Layers,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { FilterBar } from "@/components/filter-bar";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  computePlanStatus,
  deletePlan,
  getPlans,
} from "@/lib/api/plans";
import type { ListQuery, Plan } from "@/types";
import { cn } from "@/lib/utils";

export default function PlansPage() {
  const router = useRouter();
  const { isAdmin } = useAuth();

  const [search, setSearch] = React.useState("");
  const [filters, setFilters] = React.useState<Record<string, string>>({
    billingPeriod: "all",
    status: "all",
  });
  const [deletingPlanId, setDeletingPlanId] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const queryParams: ListQuery = {
    search: search.trim() || undefined,
    filters,
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["plans", queryParams],
    queryFn: () => getPlans(queryParams),
  });

  const handleDeleteConfirm = async () => {
    if (!deletingPlanId) return;
    try {
      setIsDeleting(true);
      await deletePlan(deletingPlanId);
      toast.success("Plan deleted successfully");
      setDeletingPlanId(null);
      refetch();
    } catch {
      toast.error("Failed to delete plan");
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: ColumnDef<Plan>[] = [
    {
      accessorKey: "name",
      header: "Plan Name",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground text-sm">
            {row.original.name}
          </span>
          {row.original.description && (
            <span className="text-xs text-muted-foreground truncate max-w-[220px]">
              {row.original.description}
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "price",
      header: "Price",
      cell: ({ row }) => (
        <span className="font-mono text-xs font-bold text-foreground">
          {formatCurrency(row.original.price)}
        </span>
      ),
    },
    {
      accessorKey: "billingPeriod",
      header: "Billing Period",
      cell: ({ row }) => {
        const period = row.original.billingPeriod;
        return (
          <Badge
            variant="outline"
            className={cn(
              "text-[11px] font-semibold uppercase tracking-wider capitalize",
              period === "yearly"
                ? "border-indigo-300 text-indigo-700 dark:border-indigo-800 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/40"
                : period === "monthly"
                  ? "border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/40"
                  : "border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300",
            )}
          >
            {period}
          </Badge>
        );
      },
    },
    {
      accessorKey: "minQuantity",
      header: "Min Qty",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.minQuantity} {row.original.minQuantity === 1 ? "unit" : "units"}
        </span>
      ),
    },
    {
      id: "availability",
      header: "Availability Dates",
      cell: ({ row }) => {
        const { availableFrom, availableTo } = row.original;
        if (!availableFrom && !availableTo) {
          return <span className="text-xs text-muted-foreground italic">Indefinite</span>;
        }
        return (
          <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
            <CalendarRange className="h-3.5 w-3.5 text-muted-foreground/70" />
            <span>
              {availableFrom ? formatDate(availableFrom) : "Open"} –{" "}
              {availableTo ? formatDate(availableTo) : "Open"}
            </span>
          </div>
        );
      },
    },
    {
      id: "behaviors",
      header: "Behavior Rules",
      cell: ({ row }) => {
        const { autoClose, closable, pausable, renewable } = row.original;
        return (
          <div className="flex flex-wrap gap-1 max-w-[240px]">
            {autoClose && (
              <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                Auto-close
              </span>
            )}
            {closable && (
              <span className="inline-flex items-center rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 px-1.5 py-0.5 text-[10px] font-medium">
                Closable
              </span>
            )}
            {pausable && (
              <span className="inline-flex items-center rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 px-1.5 py-0.5 text-[10px] font-medium">
                Pausable
              </span>
            )}
            {renewable && (
              <span className="inline-flex items-center rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 px-1.5 py-0.5 text-[10px] font-medium">
                Renewable
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = computePlanStatus(
          row.original.availableFrom,
          row.original.availableTo,
        );

        if (status === "scheduled") {
          return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              Scheduled
            </span>
          );
        }

        if (status === "expired") {
          return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              Expired
            </span>
          );
        }

        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Available
          </span>
        );
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem asChild>
                  <Link href={`/plans/${item.id}`} className="cursor-pointer gap-2">
                    <Edit className="h-3.5 w-3.5" />
                    {isAdmin ? "Edit plan" : "View plan"}
                  </Link>
                </DropdownMenuItem>

                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setDeletingPlanId(item.id)}
                      className="cursor-pointer gap-2 text-rose-600 focus:bg-rose-50 focus:text-rose-600 dark:focus:bg-rose-950/40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete plan
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plans"
        description="Daily, weekly, monthly, and yearly recurring pricing tiers with lifecycle policies."
        actions={
          isAdmin && (
            <Button asChild className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium">
              <Link href="/plans/new">
                <Plus className="h-4 w-4" />
                New plan
              </Link>
            </Button>
          )
        }
      />

      {/* Search and Filters */}
      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search plans by name..."
        filters={[
          {
            key: "billingPeriod",
            label: "Period",
            options: [
              { label: "Daily", value: "daily" },
              { label: "Weekly", value: "weekly" },
              { label: "Monthly", value: "monthly" },
              { label: "Yearly", value: "yearly" },
            ],
          },
          {
            key: "status",
            label: "Status",
            options: [
              { label: "Available", value: "available" },
              { label: "Scheduled", value: "scheduled" },
              { label: "Expired", value: "expired" },
            ],
          },
        ]}
        filterValues={filters}
        onFilterChange={(key, val) =>
          setFilters((prev) => ({ ...prev, [key]: val }))
        }
        onReset={() => {
          setSearch("");
          setFilters({ billingPeriod: "all", status: "all" });
        }}
      />

      {/* Main Table Area */}
      {error ? (
        <ErrorState
          title="Could not load billing plans"
          message="There was an issue retrieving the plan catalog from the datastore."
          onRetry={() => refetch()}
        />
      ) : !isLoading && data?.items.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No billing plans found"
          description={
            search || Object.values(filters).some((v) => v !== "all")
              ? "No billing tiers matched your current search and filter criteria."
              : "No plans have been created yet. Define your first subscription pricing tier."
          }
          actionLabel={isAdmin ? "Create New Plan" : undefined}
          onAction={isAdmin ? () => router.push("/plans/new") : undefined}
        />
      ) : (
        <DataTable
          columns={columns}
          data={data?.items || []}
          isLoading={isLoading}
          onRowClick={(row) => router.push(`/plans/${row.id}`)}
        />
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={Boolean(deletingPlanId)}
        onOpenChange={(open) => !open && setDeletingPlanId(null)}
        title="Delete Billing Plan"
        description="Are you sure you want to remove this plan? Existing active subscriptions will retain their contract terms, but new subscriptions cannot select this tier."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
