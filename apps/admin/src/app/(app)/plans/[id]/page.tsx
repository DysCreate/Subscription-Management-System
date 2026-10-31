"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Layers, Loader2 } from "lucide-react";
import { PlanForm } from "@/features/plans/plan-form";
import { getPlanById } from "@/lib/api/plans";
import { Button } from "@/components/ui/button";

export default function PlanDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { data: plan, isLoading, error } = useQuery({
    queryKey: ["plan", params.id],
    queryFn: () => getPlanById(params.id),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="text-xs text-muted-foreground animate-pulse">
          Loading plan details...
        </p>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center p-6 space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Layers className="h-8 w-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Plan Not Found</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            The billing plan you requested does not exist or may have been deleted.
          </p>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <Link href="/plans">
            <ArrowLeft className="h-4 w-4" />
            Back to plans
          </Link>
        </Button>
      </div>
    );
  }

  return <PlanForm initialPlan={plan} />;
}
