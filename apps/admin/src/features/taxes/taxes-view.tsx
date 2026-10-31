"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Edit,
  Lock,
  MoreHorizontal,
  Percent,
  Plus,
  Search,
  ShieldAlert,
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
import { formatCurrency } from "@/lib/format";
import { createTax, deleteTax, getTaxes, updateTax, type TaxInput } from "@/lib/api/taxes";
import type { Tax } from "@/types";
import { TaxDialog } from "./tax-dialog";

export function TaxesView() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingTax, setEditingTax] = React.useState<Tax | null>(null);
  const [deletingTaxId, setDeletingTaxId] = React.useState<string | null>(null);

  const { data: taxes = [], isLoading, error } = useQuery({
    queryKey: ["taxes"],
    queryFn: getTaxes,
  });

  const filteredTaxes = React.useMemo(() => {
    return taxes.filter((tax) => {
      const matchesSearch = tax.name.toLowerCase().includes(search.toLowerCase());
      const currentStatus = tax.status ?? "Active";
      const matchesStatus =
        statusFilter === "all" || currentStatus.toLowerCase() === statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [taxes, search, statusFilter]);

  const handleOpenCreate = () => {
    if (!isAdmin) {
      toast.error("Admin write access required to create tax rules.");
      return;
    }
    setEditingTax(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (tax: Tax) => {
    if (!isAdmin) {
      toast.error("Admin write access required to edit tax rules.");
      return;
    }
    setEditingTax(tax);
    setDialogOpen(true);
  };

  const handleSaveTax = async (values: TaxInput) => {
    if (editingTax) {
      await updateTax(editingTax.id, values);
      toast.success(`Tax "${values.name}" updated successfully.`);
    } else {
      await createTax(values);
      toast.success(`Tax "${values.name}" created successfully.`);
    }
    queryClient.invalidateQueries({ queryKey: ["taxes"] });
  };

  const handleDeleteTax = async () => {
    if (!deletingTaxId) return;
    try {
      await deleteTax(deletingTaxId);
      toast.success("Tax rule deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["taxes"] });
    } catch {
      toast.error("Failed to delete tax rule.");
    } finally {
      setDeletingTaxId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Taxes"
        description="Configure percentage GST brackets and fixed surcharge rates applied to subscriptions and invoices."
        actions={
          isAdmin ? (
            <Button
              onClick={handleOpenCreate}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Add Tax Rate
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

      {/* Staff read-only banner */}
      {!isAdmin && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p>
            You are logged in with <strong>Staff</strong> permissions. Tax creation and modification are restricted to Administrators.
          </p>
        </div>
      )}

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border/60 shadow-sm">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search taxes by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-xs bg-background"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Filter Status:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-36 text-xs bg-background">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
              <SelectItem value="active" className="text-xs">Active</SelectItem>
              <SelectItem value="inactive" className="text-xs">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Taxes Table */}
      <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mr-2" />
            Loading tax rules...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-destructive">
            Failed to load tax rules. Please refresh.
          </div>
        ) : filteredTaxes.length === 0 ? (
          <EmptyState
            icon={Percent}
            title="No matching taxes found"
            description={
              search
                ? `No tax rule matches query "${search}". Try clearing search filter.`
                : "No tax rules have been created yet."
            }
            actionLabel={isAdmin ? "Add Tax Rate" : undefined}
            onAction={isAdmin ? handleOpenCreate : undefined}
          />
        ) : (
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="text-xs font-semibold">Name</TableHead>
                <TableHead className="text-xs font-semibold">Type</TableHead>
                <TableHead className="text-xs font-semibold">Rate</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="text-xs font-semibold text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTaxes.map((tax) => {
                const taxType = tax.type ?? (tax.ratePercent != null ? "percent" : "fixed");
                const currentStatus = tax.status ?? "Active";
                const isStatusActive = currentStatus.toLowerCase() === "active";

                return (
                  <TableRow key={tax.id} className="hover:bg-muted/30 transition-colors">
                    {/* Name */}
                    <TableCell className="py-3 font-medium text-xs text-foreground">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                          {taxType === "percent" ? "%" : "₹"}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{tax.name}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            {tax.id}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    {/* Type */}
                    <TableCell className="py-3 text-xs">
                      <Badge
                        variant="secondary"
                        className="text-[10px] uppercase font-semibold tracking-wider"
                      >
                        {taxType === "percent" ? "Percentage" : "Fixed"}
                      </Badge>
                    </TableCell>

                    {/* Rate */}
                    <TableCell className="py-3 text-xs font-semibold text-foreground">
                      {taxType === "percent"
                        ? `${tax.rate ?? tax.ratePercent ?? 0}%`
                        : formatCurrency(tax.rate ?? 0)}
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-3 text-xs">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                          isStatusActive
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            isStatusActive ? "bg-emerald-500" : "bg-slate-400"
                          }`}
                        />
                        {currentStatus}
                      </span>
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
                              onClick={() => handleOpenEdit(tax)}
                              className="text-xs gap-2 cursor-pointer"
                            >
                              <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                              Edit Rule
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeletingTaxId(tax.id)}
                              className="text-xs gap-2 text-destructive cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic pr-2">
                          View only
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add / Edit Tax Dialog */}
      <TaxDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tax={editingTax}
        onSave={handleSaveTax}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deletingTaxId}
        onOpenChange={(open) => !open && setDeletingTaxId(null)}
        title="Delete Tax Rule"
        description="Are you sure you want to delete this tax rule? Any invoices already issued with this rule will remain unaffected."
        confirmLabel="Delete Rule"
        variant="destructive"
        onConfirm={handleDeleteTax}
      />
    </div>
  );
}
