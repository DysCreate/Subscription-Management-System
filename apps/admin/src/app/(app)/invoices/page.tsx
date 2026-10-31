"use client";

import * as React from "react";
import { Receipt, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function InvoicesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Track draft, confirmed, paid, and overdue invoices generated from recurring subscriptions."
        actions={
          <Button
            onClick={() => toast.info("Manual invoice creation opens in upcoming module")}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="h-4 w-4" />
            Create Invoice
          </Button>
        }
      />

      <EmptyState
        icon={Receipt}
        title="No invoices generated"
        description="Invoices are automatically produced upon subscription billing cycle renewal, or manually on demand."
        actionLabel="Create Invoice"
        onAction={() => toast.info("Action triggered: Create invoice")}
      />
    </div>
  );
}
