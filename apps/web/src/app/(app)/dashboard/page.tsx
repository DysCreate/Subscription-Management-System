"use client";

import * as React from "react";
import { LayoutDashboard, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Real-time recurring revenue metrics, subscription counts and active billing cycles."
        actions={
          <Button
            onClick={() => toast.info("Creating quick subscription quotation...")}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="h-4 w-4" />
            New Subscription
          </Button>
        }
      />

      <EmptyState
        icon={LayoutDashboard}
        title="Welcome to your Dashboard"
        description="No analytics data to display yet. As you create subscriptions and collect payments, key recurring revenue metrics will populate here."
        actionLabel="Create First Subscription"
        onAction={() => toast.info("Action triggered: Create subscription")}
      />
    </div>
  );
}
