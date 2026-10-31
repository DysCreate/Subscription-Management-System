import * as React from "react";
import { Inbox, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  /** Lucide icon shown above the heading. Defaults to Inbox. */
  icon?: LucideIcon;
  /** Primary heading. */
  title: string;
  /** Supporting body text. */
  description?: string;
  /** Label for the call-to-action button. */
  actionLabel?: string;
  /** Callback when the CTA is clicked. */
  onAction?: () => void;
  className?: string;
}

/**
 * Full-width empty state with an illustration icon + CTA.
 * Used on every list page when there are zero items.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 text-center",
        className,
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-6">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
