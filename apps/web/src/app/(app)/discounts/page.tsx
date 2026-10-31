"use client";

import * as React from "react";
import { Tag, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function DiscountsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Discounts"
        description="Create fixed rupee or percentage coupon codes with validity windows and redemption limits."
        actions={
          <Button
            onClick={() => toast.info("Create discount opens in upcoming module")}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="h-4 w-4" />
            Create Discount
          </Button>
        }
      />

      <EmptyState
        icon={Tag}
        title="No active discount codes"
        description="Incentivize long-term subscriptions with introductory percentage cuts or fixed cash discounts."
        actionLabel="Create Discount"
        onAction={() => toast.info("Action triggered: Create discount")}
      />
    </div>
  );
}
