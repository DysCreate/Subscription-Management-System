import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ErrorStateProps {
  /** Error title. Defaults to "Something went wrong". */
  title?: string;
  /** Error detail message. Shown if provided. */
  message?: string;
  /** Callback when "Try again" is clicked. */
  onRetry?: () => void;
  className?: string;
}

/**
 * Full-width error state with a warning icon and an optional retry button.
 * Used on list / detail pages when a data fetch fails.
 */
export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 text-center",
        className,
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      {message && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {message}
        </p>
      )}
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="mt-6">
          Try again
        </Button>
      )}
    </div>
  );
}
