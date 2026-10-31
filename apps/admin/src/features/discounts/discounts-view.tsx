"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Edit,
  Eye,
  Lock,
  MoreHorizontal,
  Plus,
  Search,
  ShieldAlert,
  Tag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  createDiscount,
  deleteDiscount,
  getDiscounts,
  updateDiscount,
  type DiscountInput,
} from "@/lib/api/discounts";
import { getProducts } from "@/lib/api/products";
import type { Discount, DiscountStatus } from "@/types";
import { DiscountSheet } from "./discount-sheet";

export function DiscountsView() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [selectedDiscount, setSelectedDiscount] = React.useState<Discount | null>(null);
  const [isReadOnlyView, setIsReadOnlyView] = React.useState(false);
  const [deletingDiscountId, setDeletingDiscountId] = React.useState<string | null>(null);

  const { data: discounts = [], isLoading, error } = useQuery({
    queryKey: ["discounts"],
    queryFn: getDiscounts,
  });

  const { data: productsData } = useQuery({
    queryKey: ["products"],
    queryFn: () => getProducts(),
  });

  const availableProducts = productsData?.items ?? [];

  const filteredDiscounts = React.useMemo(() => {
    return discounts.filter((d) => {
      const query = search.toLowerCase();
      const matchesSearch =
        (d.name ?? "").toLowerCase().includes(query) ||
        d.code.toLowerCase().includes(query);
      const currentStatus = d.status ?? (d.isActive ? "Active" : "Expired");
      const matchesStatus =
        statusFilter === "all" || currentStatus.toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [discounts, search, statusFilter]);

  const handleOpenCreate = () => {
    if (!isAdmin) {
      toast.error("Admin write access required to create discount rules.");
      return;
    }
    setSelectedDiscount(null);
    setIsReadOnlyView(false);
    setSheetOpen(true);
  };

  const handleOpenEdit = (discount: Discount) => {
    setSelectedDiscount(discount);
    setIsReadOnlyView(false);
    setSheetOpen(true);
  };

  const handleOpenView = (discount: Discount) => {
    setSelectedDiscount(discount);
    setIsReadOnlyView(true);
    setSheetOpen(true);
  };

  const handleSaveDiscount = async (input: DiscountInput) => {
    if (selectedDiscount) {
      await updateDiscount(selectedDiscount.id, input);
      toast.success(`Discount "${input.code}" updated successfully.`);
    } else {
      await createDiscount(input);
      toast.success(`Discount "${input.code}" created successfully.`);
    }
    queryClient.invalidateQueries({ queryKey: ["discounts"] });
  };

  const handleDeleteDiscount = async () => {
    if (!deletingDiscountId) return;
    try {
      await deleteDiscount(deletingDiscountId);
      toast.success("Discount deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["discounts"] });
    } catch {
      toast.error("Failed to delete discount.");
    } finally {
      setDeletingDiscountId(null);
    }
  };

  const getStatusBadge = (status?: DiscountStatus) => {
    const s = status ?? "Active";
    switch (s) {
      case "Active":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Active
          </span>
        );
      case "Scheduled":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/40">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
            Scheduled
          </span>
        );
      case "Exhausted":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Exhausted
          </span>
        );
      case "Expired":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Expired
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Discounts"
        description="Configure promotional percentage cuts or fixed rupee vouchers with validity windows and redemption limits."
        actions={
          isAdmin ? (
            <Button
              onClick={handleOpenCreate}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Create Discount
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs text-muted-foreground gap-1.5 py-1 px-2.5">
                <Lock className="h-3 w-3" />
                Staff View Only
              </Badge>
            </div>
          )
        }
      />

      {/* Staff informational banner */}
      {!isAdmin && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p>
            You are logged in with <strong>Staff</strong> permissions. You can view discount details, validity and usage progress, but only Administrators can create or modify discount rules.
          </p>
        </div>
      )}

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border/60 shadow-sm">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by code or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-xs bg-background"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Filter Status:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-40 text-xs bg-background">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
              <SelectItem value="active" className="text-xs">Active</SelectItem>
              <SelectItem value="scheduled" className="text-xs">Scheduled</SelectItem>
              <SelectItem value="exhausted" className="text-xs">Exhausted</SelectItem>
              <SelectItem value="expired" className="text-xs">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Discounts Table */}
      <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mr-2" />
            Loading discounts…
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-destructive">
            Failed to load discounts. Please refresh.
          </div>
        ) : filteredDiscounts.length === 0 ? (
          <EmptyState
            icon={Tag}
            title="No matching discounts found"
            description={
              search
                ? `No discount matches query "${search}". Try clearing search filter.`
                : "No discount rules have been defined yet."
            }
            actionLabel={isAdmin ? "Create Discount" : undefined}
            onAction={isAdmin ? handleOpenCreate : undefined}
          />
        ) : (
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="text-xs font-semibold">Name</TableHead>
                <TableHead className="text-xs font-semibold">Type</TableHead>
                <TableHead className="text-xs font-semibold">Value</TableHead>
                <TableHead className="text-xs font-semibold">Scope</TableHead>
                <TableHead className="text-xs font-semibold">Min purchase/qty</TableHead>
                <TableHead className="text-xs font-semibold">Valid from-to</TableHead>
                <TableHead className="text-xs font-semibold">Usage progress</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="text-xs font-semibold text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDiscounts.map((disc) => {
                const used = disc.usedCount ?? 0;
                const limit = disc.maxUses ?? 100;
                const percentage = Math.min(100, Math.round((used / limit) * 100));

                return (
                  <TableRow key={disc.id} className="hover:bg-muted/30 transition-colors">
                    {/* Name */}
                    <TableCell className="py-3 text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-foreground">
                          {disc.name || disc.code}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-200/60 dark:border-indigo-800/40">
                            {disc.code}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Type */}
                    <TableCell className="py-3 text-xs">
                      <Badge
                        variant="secondary"
                        className="text-[10px] uppercase font-semibold tracking-wider"
                      >
                        {disc.type === "percent" ? "Percentage" : "Fixed"}
                      </Badge>
                    </TableCell>

                    {/* Value */}
                    <TableCell className="py-3 text-xs font-semibold text-foreground">
                      {disc.type === "percent"
                        ? `${disc.value}%`
                        : `Rs ${disc.value}`}
                    </TableCell>

                    {/* Scope */}
                    <TableCell className="py-3 text-xs">
                      <Badge
                        variant="outline"
                        className={`text-[11px] font-normal ${
                          disc.scope === "Product"
                            ? "border-violet-300 dark:border-violet-800 text-violet-700 dark:text-violet-300 bg-violet-50/50 dark:bg-violet-950/30"
                            : "border-indigo-200 text-indigo-700 dark:text-indigo-300"
                        }`}
                      >
                        {disc.scope === "Product"
                          ? `Product (${disc.productIds?.length || 0})`
                          : "Subscription"}
                      </Badge>
                    </TableCell>

                    {/* Min purchase/qty */}
                    <TableCell className="py-3 text-[11px] text-muted-foreground">
                      <div className="flex flex-col gap-0.5">
                        <span>
                          {disc.minPurchaseAmount && disc.minPurchaseAmount > 0
                            ? `Min: ${formatCurrency(disc.minPurchaseAmount)}`
                            : "No min spend"}
                        </span>
                        <span>
                          {disc.minQuantity && disc.minQuantity > 1
                            ? `Min qty: ${disc.minQuantity}`
                            : "Min qty: 1"}
                        </span>
                      </div>
                    </TableCell>

                    {/* Valid from-to */}
                    <TableCell className="py-3 text-[11px] text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1 font-mono">
                        <span>{disc.validFrom ? formatDate(disc.validFrom) : "Immediate"}</span>
                        <span>→</span>
                        <span>{disc.validTo ? formatDate(disc.validTo) : "Never"}</span>
                      </div>
                    </TableCell>

                    {/* Usage progress bar */}
                    <TableCell className="py-3 text-xs min-w-[140px]">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                          <span>{used} / {limit}</span>
                          <span>{percentage}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              percentage >= 100
                                ? "bg-amber-500"
                                : percentage >= 75
                                ? "bg-indigo-600"
                                : "bg-emerald-500"
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-3 text-xs">
                      {getStatusBadge(disc.status)}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="py-3 text-right pr-4">
                      {isAdmin ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36">
                            <DropdownMenuItem
                              onClick={() => handleOpenEdit(disc)}
                              className="text-xs gap-2 cursor-pointer"
                            >
                              <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                              Edit Rule
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeletingDiscountId(disc.id)}
                              className="text-xs gap-2 text-destructive cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenView(disc)}
                          className="h-7 text-xs gap-1.5 text-indigo-600 hover:text-indigo-700"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Discount Sheet */}
      <DiscountSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        discount={selectedDiscount}
        readOnly={isReadOnlyView}
        availableProducts={availableProducts}
        onSave={handleSaveDiscount}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deletingDiscountId}
        onOpenChange={(open) => !open && setDeletingDiscountId(null)}
        title="Delete Discount"
        description="Are you sure you want to delete this promotional discount code? Existing applied subscriptions will retain their terms."
        confirmLabel="Delete Discount"
        variant="destructive"
        onConfirm={handleDeleteDiscount}
      />
    </div>
  );
}
