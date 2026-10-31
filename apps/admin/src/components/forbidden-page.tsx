"use client";

import * as React from "react";
import Link from "next/link";
import { ShieldAlert, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";

export function ForbiddenPage() {
  const { role, switchRole } = useAuth();

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center animate-in fade-in-50 duration-200">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-rose-50 ring-8 ring-rose-50/50 dark:bg-rose-950/40 dark:ring-rose-950/20">
        <ShieldAlert className="h-10 w-10 text-rose-600 dark:text-rose-400" />
      </div>

      <div className="mt-6 flex items-center justify-center gap-2">
        <Badge variant="destructive" className="font-mono text-xs">
          403 FORBIDDEN
        </Badge>
        <span className="text-xs text-muted-foreground">
          Current Role: <strong className="capitalize">{role ?? "staff"}</strong>
        </span>
      </div>

      <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
        Access Restricted
      </h1>

      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        You don&apos;t have permission to access this page. Only users with the{" "}
        <strong className="text-foreground">Admin</strong> role can view or manage
        this section of SubLoop.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button asChild variant="default">
          <Link href="/dashboard" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Return to Dashboard
          </Link>
        </Button>

        {/* Development role switch helper */}
        <Button
          variant="outline"
          onClick={() => switchRole("admin")}
          className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-900 dark:text-indigo-300 dark:hover:bg-indigo-950/50"
        >
          <RefreshCw className="h-4 w-4" />
          Switch to Admin (Dev Mode)
        </Button>
      </div>

      <p className="mt-6 text-xs text-muted-foreground/80">
        Tip: You can also switch roles anytime via the profile menu in the top bar.
      </p>
    </div>
  );
}
