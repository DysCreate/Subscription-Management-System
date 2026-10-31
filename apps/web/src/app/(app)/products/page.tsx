"use client";

import * as React from "react";
import { Package, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ProductsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Catalog of sellable software products, add-on modules, and attribute variants."
        actions={
          <Button
            onClick={() => toast.info("Create product opens in upcoming module")}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        }
      />

      <EmptyState
        icon={Package}
        title="Catalog is empty"
        description="Add your first base product or service offering to start configuring recurring billing plans."
        actionLabel="Add Product"
        onAction={() => toast.info("Action triggered: Add product")}
      />
    </div>
  );
}
