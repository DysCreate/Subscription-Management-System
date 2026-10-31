import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Status-to-variant mapping per the domain spec:
 * green = paid/active, amber = pending/quotation/paused,
 * red = overdue/cancelled, blue = confirmed, grey = draft/closed.
 */

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      status: {
        /* ---- subscription statuses ---- */
        draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
        quotation:
          "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
        confirmed:
          "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
        active:
          "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
        paused:
          "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
        closed:
          "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",

        /* ---- invoice statuses ---- */
        paid: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
        overdue: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
        cancelled:
          "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
      },
    },
    defaultVariants: {
      status: "draft",
    },
  },
);

/** Small dot color matching the status — gives the "pill badge with a dot" look. */
const dotColorMap: Record<string, string> = {
  draft: "bg-slate-400",
  quotation: "bg-amber-500",
  confirmed: "bg-blue-500",
  active: "bg-emerald-500",
  paused: "bg-amber-500",
  closed: "bg-slate-400",
  paid: "bg-emerald-500",
  overdue: "bg-red-500",
  cancelled: "bg-red-500",
};

const labelMap: Record<string, string> = {
  draft: "Draft",
  quotation: "Quotation",
  confirmed: "Confirmed",
  active: "Active",
  paused: "Paused",
  closed: "Closed",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

export interface StatusBadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children">,
    VariantProps<typeof statusBadgeVariants> {
  /** Override the display label. If omitted, the status name is capitalised. */
  label?: string;
}

export function StatusBadge({
  className,
  status = "draft",
  label,
  ...props
}: StatusBadgeProps) {
  const key = status ?? "draft";

  return (
    <span
      className={cn(statusBadgeVariants({ status }), className)}
      {...props}
    >
      <span
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          dotColorMap[key],
        )}
        aria-hidden
      />
      {label ?? labelMap[key] ?? key}
    </span>
  );
}
