import { format, formatDistanceToNowStrict, parseISO } from "date-fns";

/**
 * Single source of truth for money formatting: INR, en-IN grouping.
 * Used everywhere money is displayed (tables, invoices, cards).
 */
export function formatCurrency(
  value: number,
  options?: {
    /** Use compact notation, e.g. ₹1.2L instead of ₹1,20,000 */
    compact?: boolean;
    maximumFractionDigits?: number;
    minimumFractionDigits?: number;
  },
): string {
  const {
    compact = false,
    maximumFractionDigits = compact ? 1 : 2,
    minimumFractionDigits,
  } = options ?? {};

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: compact ? "compact" : "standard",
    compactDisplay: compact ? "short" : undefined,
    maximumFractionDigits,
    minimumFractionDigits,
  }).format(value);
}

/**
 * Single source of truth for date formatting: dd MMM yyyy, e.g. "14 Feb 2026".
 */
export function formatDate(
  date: string | number | Date,
  pattern = "dd MMM yyyy",
): string {
  const parsed = toDate(date);
  if (!parsed) return "—";
  return format(parsed, pattern);
}

/**
 * Date + time helper, e.g. "14 Feb 2026, 5:32 pm" — for timestamps like payments.
 */
export function formatDateTime(date: string | number | Date): string {
  const parsed = toDate(date);
  if (!parsed) return "—";
  return format(parsed, "dd MMM yyyy, h:mm a");
}

/** Relative time for activity/recent lists, e.g. "3 days ago". */
export function formatRelative(date: string | number | Date): string {
  const parsed = toDate(date);
  if (!parsed) return "—";
  return formatDistanceToNowStrict(parsed, { addSuffix: true });
}

/**
 * Number formatting with Indian grouping, e.g. 1,25,000.
 * `tabular-nums` should be applied by the component rendering it.
 */
export function formatNumber(
  value: number,
  options?: {
    compact?: boolean;
    maximumFractionDigits?: number;
    minimumFractionDigits?: number;
  },
): string {
  const {
    compact = false,
    maximumFractionDigits = compact ? 1 : 2,
    minimumFractionDigits,
  } = options ?? {};

  return new Intl.NumberFormat("en-IN", {
    notation: compact ? "compact" : "standard",
    compactDisplay: compact ? "short" : undefined,
    maximumFractionDigits,
    minimumFractionDigits,
  }).format(value);
}

/** Formats a "14 Feb – 16 Feb 2026"-style label; keeps single year when equal. */
export function formatDateRange(from?: Date, to?: Date): string {
  if (!from && !to) return "";
  if (from && !to) return format(from, "dd MMM yyyy");
  if (!from && to) return format(to, "dd MMM yyyy");
  const sameYear = from?.getFullYear() === to?.getFullYear();
  const start = sameYear ? "dd MMM" : "dd MMM yyyy";
  return `${
    from ? format(from, start) : ""
  } – ${to ? `${format(to, "dd MMM yyyy")}` : ""}`;
}

function toDate(date: string | number | Date): Date | undefined {
  if (date instanceof Date) {
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  if (typeof date === "number") return new Date(date);
  try {
    return parseISO(date);
  } catch {
    return undefined;
  }
}
