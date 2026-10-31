"use client";

import * as React from "react";
import { Layers, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function PlansPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Plans"
        description="Daily, weekly, monthly, and yearly recurring pricing tiers tied to products and variants."
        actions={
          <Button
            onClick={() => toast.info("Create plan opens in upcoming module")}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="h-4 w-4" />
            Create Plan
          </Button>
        }
      />

      <EmptyState
        icon={Layers}
        title="No billing plans defined"
        description="Configure subscription cadences and tier pricing with trial period options."
        actionLabel="Create Plan"
        onAction={() => toast.info("Action triggered: Create plan")}
      />
    </div>
  );
}
