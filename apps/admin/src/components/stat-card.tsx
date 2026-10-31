import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  /** Main heading (e.g. "Total Revenue"). */
  title: string;
  /** Primary metric value. */
  value: string;
  /** Optional trend or secondary info shown below the value. */
  subtitle?: string;
  /** Lucide icon rendered at top-right of the card. */
  icon?: LucideIcon;
  /** Accent colour class for the icon background, e.g. "bg-emerald-100 text-emerald-600". */
  iconClassName?: string;
  className?: string;
}

/**
 * KPI stat card used in dashboard summaries.
 * Rounded-xl card with an icon accent, tight typography, and tabular numbers.
 */
export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconClassName,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("transition-shadow hover:shadow-md", className)}>
      <CardContent className="flex items-start justify-between p-6">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              iconClassName ?? "bg-primary/10 text-primary",
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
