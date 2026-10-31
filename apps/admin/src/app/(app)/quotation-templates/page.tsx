"use client";

import * as React from "react";
import { FileText, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function QuotationTemplatesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotation Templates"
        description="Preconfigure reusable bundles of products, plans, taxes, and standard discount rules."
        actions={
          <Button
            onClick={() => toast.info("Create template opens in upcoming module")}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="h-4 w-4" />
            New Template
          </Button>
        }
      />

      <EmptyState
        icon={FileText}
        title="No quotation templates"
        description="Speed up subscription quotes by creating templates with standard recurring packages."
        actionLabel="Create Template"
        onAction={() => toast.info("Action triggered: Create template")}
      />
    </div>
  );
}
