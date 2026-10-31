"use client";

import * as React from "react";
import { CreditCard, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function PaymentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Monitor settled collections via UPI, credit/debit cards, bank transfer, and cheque."
        actions={
          <Button
            onClick={() => toast.info("Record payment dialog opens in upcoming module")}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="h-4 w-4" />
            Record Payment
          </Button>
        }
      />

      <EmptyState
        icon={CreditCard}
        title="No payments recorded"
        description="Payments received from customers against open invoices will appear here in chronological order."
        actionLabel="Record Payment"
        onAction={() => toast.info("Action triggered: Record payment")}
      />
    </div>
  );
}
