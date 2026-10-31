"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Edit,
  MoreHorizontal,
  Package,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
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
import { formatCurrency } from "@/lib/format";
import {
  calculateMargin,
  deleteProduct,
  getProducts,
} from "@/lib/api/products";
import type { ListQuery, Product } from "@/types";
import { cn } from "@/lib/utils";

export default function ProductsPage() {
  const router = useRouter();
  const { isAdmin } = useAuth();

  const [search, setSearch] = React.useState("");
  const [filters, setFilters] = React.useState<Record<string, string>>({
    type: "all",
    status: "all",
  });
  const [deletingProductId, setDeletingProductId] = React.useState<string | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = React.useState(false);

  const queryParams: ListQuery = {
    search: search.trim() || undefined,
    filters,
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["products", queryParams],
    queryFn: () => getProducts(queryParams),
  });

  const handleDeleteConfirm = async () => {
    if (!deletingProductId) return;
    try {
      setIsDeleting(true);
      await deleteProduct(deletingProductId);
      toast.success("Product deleted successfully");
      setDeletingProductId(null);
      refetch();
    } catch {
      toast.error("Failed to delete product");
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: ColumnDef<Product>[] = [
    {
      accessorKey: "name",
      header: "Product Name",
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex flex-col">
            <span className="font-semibold text-foreground text-sm">
              {item.name}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {item.sku || `PROD-${item.id.slice(-4)}`}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs font-medium">
          {row.original.type}
        </Badge>
      ),
    },
    {
      accessorKey: "salesPrice",
      header: "Sales Price",
      cell: ({ row }) => (
        <span className="font-mono text-xs font-semibold text-foreground">
          {formatCurrency(row.original.salesPrice)}
        </span>
      ),
    },
    {
      accessorKey: "costPrice",
      header: "Cost Price",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {formatCurrency(row.original.costPrice)}
        </span>
      ),
    },
    {
      id: "margin",
      header: "Margin %",
      cell: ({ row }) => {
        const item = row.original;
        const margin = calculateMargin(item.salesPrice, item.costPrice);

        return (
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-mono font-bold",
                margin.tier === "high"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                  : margin.tier === "moderate"
                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                    : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400",
              )}
            >
              {margin.tier === "high" ? (
                <TrendingUp className="h-3 w-3" />
              ) : margin.tier === "moderate" ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {margin.marginPercent}%
            </span>
          </div>
        );
      },
    },
    {
      id: "variants",
      header: "Variants",
      cell: ({ row }) => {
        const count = row.original.variants?.length || 0;
        return (
          <span className="text-xs text-muted-foreground">
            {count === 0 ? "0 variants" : `${count} ${count === 1 ? "variant" : "variants"}`}
          </span>
        );
      },
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => {
        const active = row.original.isActive;
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
              active
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                active ? "bg-emerald-500" : "bg-slate-400",
              )}
            />
            {active ? "Active" : "Inactive"}
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
                  <Link href={`/products/${item.id}`} className="cursor-pointer gap-2">
                    <Edit className="h-3.5 w-3.5" />
                    {isAdmin ? "Edit product" : "View product"}
                  </Link>
                </DropdownMenuItem>

                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setDeletingProductId(item.id)}
                      className="cursor-pointer gap-2 text-rose-600 focus:bg-rose-50 focus:text-rose-600 dark:focus:bg-rose-950/40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete product
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
        title="Products"
        description="Catalog of sellable software products, add-on modules, and attribute variants."
        actions={
          isAdmin && (
            <Button asChild className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium">
              <Link href="/products/new">
                <Plus className="h-4 w-4" />
                New product
              </Link>
            </Button>
          )
        }
      />

      {/* Search and Filters */}
      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search products by name or SKU..."
        filters={[
          {
            key: "type",
            label: "Type",
            options: [
              { label: "Software", value: "Software" },
              { label: "Add-on", value: "Add-on" },
              { label: "Service", value: "Service" },
              { label: "Hardware", value: "Hardware" },
            ],
          },
          {
            key: "status",
            label: "Status",
            options: [
              { label: "Active", value: "active" },
              { label: "Inactive", value: "inactive" },
            ],
          },
        ]}
        filterValues={filters}
        onFilterChange={(key, val) =>
          setFilters((prev) => ({ ...prev, [key]: val }))
        }
        onReset={() => {
          setSearch("");
          setFilters({ type: "all", status: "all" });
        }}
      />

      {/* Main Table Area */}
      {error ? (
        <ErrorState
          title="Could not load products"
          message="There was an issue retrieving the catalog from the datastore."
          onRetry={() => refetch()}
        />
      ) : !isLoading && data?.items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products found"
          description={
            search || Object.values(filters).some((v) => v !== "all")
              ? "No catalog items matched your current search and filter criteria."
              : "Your catalog is empty. Create your first base product or service."
          }
          actionLabel={isAdmin ? "Create New Product" : undefined}
          onAction={isAdmin ? () => router.push("/products/new") : undefined}
        />
      ) : (
        <DataTable
          columns={columns}
          data={data?.items || []}
          isLoading={isLoading}
          onRowClick={(row) => router.push(`/products/${row.id}`)}
        />
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={Boolean(deletingProductId)}
        onOpenChange={(open) => !open && setDeletingProductId(null)}
        title="Delete Product"
        description="Are you sure you want to remove this product from the catalog? This action will permanently archive all attached variants."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
