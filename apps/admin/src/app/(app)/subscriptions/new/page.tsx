"use client";

import * as React from "react";
import { SubscriptionForm } from "@/features/subscriptions/subscription-form";

export default function NewSubscriptionPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            Loading subscription builder…
          </div>
        </div>
      }
    >
      <SubscriptionForm />
    </React.Suspense>
  );
}
