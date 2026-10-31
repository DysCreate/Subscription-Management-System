"use client";

import * as React from "react";
import { Percent, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function TaxesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Taxes"
        description="Configure inclusive and exclusive tax rates (e.g. GST 18%, IGST) applied to invoices and lines."
        actions={
          <Button
            onClick={() => toast.info("Add tax rate opens in upcoming module")}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="h-4 w-4" />
            Add Tax Rate
          </Button>
        }
      />

      <EmptyState
        icon={Percent}
        title="No tax rules defined"
        description="Set up your tax brackets to ensure automated calculation on subscription quotations and tax invoices."
        actionLabel="Add Tax Rate"
        onAction={() => toast.info("Action triggered: Add tax rate")}
      />
    </div>
  );
}
