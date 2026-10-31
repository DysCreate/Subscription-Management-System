"use client";

import * as React from "react";
import { Repeat, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function SubscriptionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        description="Manage customer subscriptions across lifecycle statuses: Draft, Quotation, Confirmed, Active and Closed."
        actions={
          <Button
            onClick={() => toast.info("New subscription wizard opens in upcoming module")}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="h-4 w-4" />
            New Subscription
          </Button>
        }
      />

      <EmptyState
        icon={Repeat}
        title="No subscriptions found"
        description="You have not created any customer subscriptions yet. Start by generating a quotation or activating a recurring plan."
        actionLabel="Create Subscription"
        onAction={() => toast.info("Action triggered: Create subscription")}
      />
    </div>
  );
}
