"use client";

import * as React from "react";
import { Users, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function CustomersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="View and manage accounts, billing contacts, GST credentials, and payment history."
        actions={
          <Button
            onClick={() => toast.info("Add customer dialog opens in upcoming module")}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="h-4 w-4" />
            Add Customer
          </Button>
        }
      />

      <EmptyState
        icon={Users}
        title="No customers yet"
        description="Your client directory is currently empty. Add your first customer to begin quoting subscriptions."
        actionLabel="Add Customer"
        onAction={() => toast.info("Action triggered: Add customer")}
      />
    </div>
  );
}
