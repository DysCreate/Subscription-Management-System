"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, differenceInCalendarDays } from "date-fns";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Ban,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  PauseCircle,
  PlayCircle,
  Receipt,
  RefreshCw,
  RotateCcw,
  Send,
  StickyNote,
} from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { StatusBadge } from "@/components/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, formatDate, formatDateTime, formatRelative } from "@/lib/format";
import { getAllCustomers } from "@/lib/api/customers";
import { MOCK_DISCOUNTS } from "@/lib/api/discounts";
import { getInvoicesForSubscription } from "@/lib/api/invoices";
import { getPlans } from "@/lib/api/plans";
import { getProducts } from "@/lib/api/products";
import { MOCK_QUOTATION_TEMPLATES } from "@/lib/api/quotation-templates";
import {
  addSubscriptionNote,
  getSubscriptionActivity,
  getSubscriptionNotes,
  recordSubscriptionActivity,
  type SubscriptionActivityEvent,
} from "@/lib/api/subscription-activity";
import {
  calculateSubscriptionTotal,
  getSubscriptionById,
  renewSubscription,
  resolveSubscriptionPlans,
  updateSubscriptionStatus,
} from "@/lib/api/subscriptions";
import type {
  Invoice,
  Plan,
  Product,
  Subscription,
  SubscriptionStatus,
} from "@/types";
import { isInvoiceOverdue } from "@/types";
import { cn } from "@/lib/utils";

const TERM_LABELS: Record<string, string> = {
  immediate: "Immediate",
  net_15: "Net 15",
  net_30: "Net 30",
  net_60: "Net 60",
};

const LIFECYCLE: Array<{ status: SubscriptionStatus; label: string }> = [
  { status: "draft", label: "Draft" },
  { status: "quotation", label: "Quotation" },
  { status: "confirmed", label: "Confirmed" },
  { status: "active", label: "Active" },
  { status: "closed", label: "Closed" },
];

const STATUS_ICONS: Record<SubscriptionStatus, LucideIcon> = {
  draft: FileText,
  quotation: Send,
  confirmed: CheckCircle2,
  active: PlayCircle,
  paused: PauseCircle,
  closed: Ban,
};

type ConfirmAction = "pause" | "close";

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function lifecycleIndex(status: SubscriptionStatus): number {
  if (status === "paused") return 3;
  return LIFECYCLE.findIndex((step) => step.status === status);
}

function quotationExpiry(subscription: Subscription): {
  daysLeft: number;
  expiresAt: Date;
} {
  const expiresAt = addDays(new Date(subscription.createdAt), 14);
  return {
    daysLeft: differenceInCalendarDays(expiresAt, new Date()),
    expiresAt,
  };
}

function InfoItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}

function LifecycleStepper({ status }: { status: SubscriptionStatus }) {
  const current = lifecycleIndex(status);

  return (
    <Card className="shadow-sm">
      <CardContent className="overflow-x-auto py-5">
        <div className="flex min-w-[520px] items-start">
          {LIFECYCLE.map((step, index) => {
            const complete = index < current;
            const active = index === current;
            return (
              <React.Fragment key={step.status}>
                {index > 0 && (
                  <div
                    className={cn(
                      "mt-4 h-0.5 flex-1 rounded-full",
                      index <= current ? "bg-indigo-500" : "bg-border",
                    )}
                  />
                )}
                <div className="flex w-24 shrink-0 flex-col items-center gap-2">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                      complete &&
                        "border-indigo-600 bg-indigo-600 text-white",
                      active &&
                        "border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-900",
                      !complete &&
                        !active &&
                        "border-border bg-background text-muted-foreground",
                    )}
                    aria-current={active ? "step" : undefined}
                  >
                    {complete ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      active && "text-indigo-700 dark:text-indigo-300",
                      complete && "text-foreground",
                      !complete && !active && "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
        {status === "paused" && (
          <p className="mt-4 text-center text-xs font-medium text-amber-600 dark:text-amber-400">
            Subscription is currently paused at the Active stage.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function InvoiceStatus({ invoice }: { invoice: Invoice }) {
  if (isInvoiceOverdue(invoice)) {
    return <StatusBadge status="overdue" />;
  }
  return <StatusBadge status={invoice.status} />;
}

function ActivityTimeline({ events }: { events: SubscriptionActivityEvent[] }) {
  const ordered = [...events].reverse();

  return (
    <ol className="relative ml-3 space-y-6 border-l border-border pl-6">
      {ordered.map((event, index) => {
        const Icon = STATUS_ICONS[event.status] ?? FileText;
        const isLatest = index === 0;
        return (
          <li key={event.id} className="relative">
            <span
              className={cn(
                "absolute -left-[37px] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background",
                isLatest
                  ? "bg-indigo-600 text-white"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <Icon className="h-3 w-3" />
            </span>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-sm font-medium">{event.title}</p>
              {isLatest && (
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  Latest
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {event.actor} · {formatDateTime(event.createdAt)} ·{" "}
              {formatRelative(event.createdAt)}
            </p>
            {event.reason && (
              <p className="mt-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                &ldquo;{event.reason}&rdquo;
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default function SubscriptionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const actor = user?.name ?? "Aarav Menon";

  const [confirmAction, setConfirmAction] =
    React.useState<ConfirmAction | null>(null);
  const [reason, setReason] = React.useState("");
  const [isActing, setIsActing] = React.useState(false);
  const [noteDraft, setNoteDraft] = React.useState("");
  const [isSavingNote, setIsSavingNote] = React.useState(false);

  const subscriptionQuery = useQuery({
    queryKey: ["subscription", params.id],
    queryFn: () => getSubscriptionById(params.id),
  });
  const customersQuery = useQuery({
    queryKey: ["customers", "all"],
    queryFn: getAllCustomers,
  });
  const plansQuery = useQuery({
    queryKey: ["plans", "all"],
    queryFn: () => getPlans({ pageSize: 100 }),
  });
  const productsQuery = useQuery({
    queryKey: ["products", "all"],
    queryFn: () => getProducts({ pageSize: 100 }),
  });

  const subscription = subscriptionQuery.data;

  const invoicesQuery = useQuery({
    queryKey: ["subscription", params.id, "invoices"],
    queryFn: () => getInvoicesForSubscription(subscription!),
    enabled: Boolean(subscription),
  });
  const activityQuery = useQuery({
    queryKey: ["subscription", params.id, "activity"],
    queryFn: () => getSubscriptionActivity(subscription!),
    enabled: Boolean(subscription),
  });
  const notesQuery = useQuery({
    queryKey: ["subscription", params.id, "notes"],
    queryFn: () => getSubscriptionNotes(params.id),
  });

  const customer = (customersQuery.data ?? []).find(
    (item) => item.id === subscription?.customerId,
  );
  const plans: Plan[] = plansQuery.data?.items ?? [];
  const products: Product[] = productsQuery.data?.items ?? [];
  const plan = plans.find((item) => item.id === subscription?.lines[0]?.planId);

  const invalidateSubscription = React.useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: ["subscription", params.id],
    });
  }, [queryClient, params.id]);

  const applyStatus = async (
    next: SubscriptionStatus,
    options?: { title?: string; reason?: string; message?: string },
  ): Promise<boolean> => {
    if (!subscription) return false;
    setIsActing(true);
    try {
      await updateSubscriptionStatus(subscription.id, next);
      await recordSubscriptionActivity(subscription.id, {
        status: next,
        title: options?.title,
        actor,
        reason: options?.reason,
      });
      toast.success(options?.message ?? "Subscription updated");
      await invalidateSubscription();
      return true;
    } catch {
      toast.error("Could not update the subscription");
      return false;
    } finally {
      setIsActing(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!subscription || !confirmAction || !reason.trim()) return;
    const isPause = confirmAction === "pause";
    const updated = await applyStatus(isPause ? "paused" : "closed", {
      reason: reason.trim(),
      message: isPause
        ? "Subscription paused"
        : "Subscription closed",
    });
    if (updated) {
      setConfirmAction(null);
      setReason("");
    }
  };

  const handleRenew = async () => {
    if (!subscription) return;
    setIsActing(true);
    try {
      const updated = await renewSubscription(subscription.id);
      await recordSubscriptionActivity(subscription.id, {
        status: "active",
        title: "Subscription renewed",
        actor,
        reason: updated.endDate
          ? `Contract extended to ${formatDate(updated.endDate)}.`
          : undefined,
      });
      toast.success(
        updated.endDate
          ? `Subscription renewed until ${formatDate(updated.endDate)}`
          : "Subscription renewed",
      );
      await invalidateSubscription();
    } catch {
      toast.error("Could not renew the subscription");
    } finally {
      setIsActing(false);
    }
  };

  const handleAddNote = async () => {
    if (!subscription || !noteDraft.trim()) return;
    setIsSavingNote(true);
    try {
      await addSubscriptionNote(subscription.id, noteDraft, actor);
      setNoteDraft("");
      toast.success("Note added");
      await notesQuery.refetch();
    } catch {
      toast.error("Could not add the note");
    } finally {
      setIsSavingNote(false);
    }
  };

  if (subscriptionQuery.error) {
    return (
      <ErrorState
        title="Subscription not found"
        message="The subscription could not be loaded. It may have been removed."
        onRetry={() => subscriptionQuery.refetch()}
      />
    );
  }

  if (subscriptionQuery.isLoading || !subscription) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const total = calculateSubscriptionTotal(subscription);
  const planName = resolveSubscriptionPlans(subscription, plans, products);
  const discount = MOCK_DISCOUNTS.find(
    (item) => item.id === subscription.discountId,
  );
  const template = MOCK_QUOTATION_TEMPLATES.find(
    (item) => item.id === subscription.quotationTemplateId,
  );
  const showQuotationExpiry = subscription.status === "quotation";
  const expiry = showQuotationExpiry
    ? quotationExpiry(subscription)
    : undefined;

  const canPause = plan ? plan.pausable : true;
  const canClose = plan ? plan.closable : true;
  const canRenew = plan ? plan.renewable : true;

  const invoices = invoicesQuery.data ?? [];
  const activity = activityQuery.data ?? [];
  const notes = notesQuery.data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <Button asChild variant="outline" size="icon" className="mt-1 h-9 w-9">
            <Link href="/subscriptions" aria-label="Back to subscriptions">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">
                {subscription.subscriptionNumber}
              </h1>
              <StatusBadge
                status={subscription.status}
                className="px-3 py-1 text-sm"
              />
              {expiry && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                    expiry.daysLeft > 2
                      ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                      : "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
                  )}
                  title={`Quotation expires on ${formatDate(expiry.expiresAt)}`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  {expiry.daysLeft > 0
                    ? `Expires in ${expiry.daysLeft} day${
                        expiry.daysLeft === 1 ? "" : "s"
                      }`
                    : "Quotation expired"}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="bg-indigo-100 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    {initials(customer?.name ?? "Customer")}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-foreground">
                  {customer?.name ?? "Unknown customer"}
                </span>
                {customer?.companyName && (
                  <span className="hidden text-xs sm:inline">
                    · {customer.companyName}
                  </span>
                )}
              </span>
              <span className="hidden h-1 w-1 rounded-full bg-border sm:block" />
              <span>
                Plan <span className="font-medium text-foreground">{planName}</span>
              </span>
              <span className="hidden h-1 w-1 rounded-full bg-border sm:block" />
              <span>Created {formatDate(subscription.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Primary actions depend on the lifecycle status */}
        <div className="flex flex-wrap items-center gap-2">
          {subscription.status === "draft" && (
            <Button
              className="gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700"
              disabled={isActing}
              onClick={() =>
                applyStatus("quotation", {
                  message: "Quotation sent to customer",
                })
              }
            >
              {isActing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send quotation
            </Button>
          )}

          {subscription.status === "quotation" && (
            <Button
              className="gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700"
              disabled={isActing}
              onClick={() =>
                applyStatus("confirmed", {
                  message: "Subscription confirmed",
                })
              }
            >
              {isActing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Confirm
            </Button>
          )}

          {subscription.status === "confirmed" && (
            <Button
              className="gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700"
              disabled={isActing}
              onClick={() =>
                applyStatus("active", {
                  message: "Subscription activated",
                })
              }
            >
              {isActing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="h-4 w-4" />
              )}
              Activate
            </Button>
          )}

          {subscription.status === "active" && (
            <>
              {canPause && (
                <Button
                  className="gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700"
                  disabled={isActing}
                  onClick={() => {
                    setReason("");
                    setConfirmAction("pause");
                  }}
                >
                  <PauseCircle className="h-4 w-4" />
                  Pause
                </Button>
              )}
              {canClose && (
                <Button
                  variant="outline"
                  className="gap-1.5 text-rose-600 hover:text-rose-700"
                  disabled={isActing}
                  onClick={() => {
                    setReason("");
                    setConfirmAction("close");
                  }}
                >
                  <Ban className="h-4 w-4" />
                  Close
                </Button>
              )}
              {canRenew && (
                <Button
                  variant="outline"
                  className="gap-1.5"
                  disabled={isActing}
                  onClick={handleRenew}
                >
                  {isActing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  Renew
                </Button>
              )}
            </>
          )}

          {subscription.status === "paused" && (
            <Button
              className="gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700"
              disabled={isActing}
              onClick={() =>
                applyStatus("active", {
                  title: "Subscription resumed",
                  message: "Subscription resumed",
                })
              }
            >
              {isActing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="h-4 w-4" />
              )}
              Resume
            </Button>
          )}
        </div>
      </div>

      <LifecycleStepper status={subscription.status} />

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="h-auto w-full justify-start overflow-x-auto p-1 sm:w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="invoices">
            Invoices
            {invoices.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[10px] font-semibold">
                {invoices.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Subscription details</CardTitle>
              <CardDescription>
                Contract window, billing cadence and linked records
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <InfoItem label="Customer">
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-indigo-100 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                      {initials(customer?.name ?? "Customer")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate">
                      {customer?.name ?? "Unknown customer"}
                    </p>
                    <p className="truncate text-xs font-normal text-muted-foreground">
                      {customer?.email ?? "—"}
                    </p>
                  </div>
                </div>
              </InfoItem>
              <InfoItem label="Plan">{planName}</InfoItem>
              <InfoItem label="Billing cycle">
                {plan
                  ? plan.billingPeriod.charAt(0).toUpperCase() +
                    plan.billingPeriod.slice(1)
                  : "Monthly"}
              </InfoItem>
              <InfoItem label="Start date">
                <span className="flex items-center gap-2">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  {formatDate(subscription.startDate)}
                </span>
              </InfoItem>
              <InfoItem label="Expiry date">
                <span className="flex items-center gap-2">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  {subscription.endDate
                    ? formatDate(subscription.endDate)
                    : "—"}
                </span>
              </InfoItem>
              <InfoItem label="Next billing date">
                {subscription.nextBillingDate
                  ? formatDate(subscription.nextBillingDate)
                  : "—"}
              </InfoItem>
              <InfoItem label="Payment terms">
                {TERM_LABELS[subscription.paymentTerms ?? "immediate"] ??
                  "Immediate"}
              </InfoItem>
              <InfoItem label="Quotation template">
                {template?.name ?? "—"}
              </InfoItem>
              <InfoItem label="Discount">
                {discount
                  ? discount.name ?? discount.code
                  : "No discount applied"}
              </InfoItem>
              {subscription.closedAt && (
                <InfoItem label="Closed on">
                  {formatDate(subscription.closedAt)}
                </InfoItem>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="shadow-sm lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Order lines</CardTitle>
                <CardDescription>
                  Products, quantities and taxes billed every cycle
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-xl border">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit price</TableHead>
                        <TableHead className="text-right">Tax</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subscription.lines.map((line) => {
                        const product = products.find(
                          (item) => item.id === line.productId,
                        );
                        const variant = product?.variants.find(
                          (item) => item.id === line.variantId,
                        );
                        const linePlan = plans.find(
                          (item) => item.id === line.planId,
                        );
                        return (
                          <TableRow key={line.id}>
                            <TableCell>
                              <p className="text-sm font-medium">
                                {product?.name ?? "Product"}
                              </p>
                              {variant && (
                                <p className="text-xs text-muted-foreground">
                                  {variant.attribute} = {variant.value}
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {linePlan?.name ?? "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm tabular-nums">
                              {line.quantity}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm tabular-nums">
                              {formatCurrency(line.unitPrice)}
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">
                              {line.taxRatePercent}%
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm font-semibold tabular-nums">
                              {formatCurrency(line.quantity * line.unitPrice)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card className="h-fit shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Receipt className="h-4 w-4 text-indigo-600" />
                  Totals
                </CardTitle>
                <CardDescription>Amount per billing cycle</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(subscription.subtotal ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 text-muted-foreground">
                    Discount
                    {discount && (
                      <span className="block truncate text-xs">
                        {discount.name ?? discount.code}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                    − {formatCurrency(subscription.discountTotal ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Taxes</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(subscription.taxTotal ?? 0)}
                  </span>
                </div>
                <div className="flex items-end justify-between border-t pt-3">
                  <span className="font-medium">Total per cycle</span>
                  <span className="font-mono text-xl font-bold tabular-nums">
                    {formatCurrency(total)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Invoices */}
        <TabsContent value="invoices">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Invoices</CardTitle>
              <CardDescription>
                Invoices generated from this subscription
              </CardDescription>
            </CardHeader>
            <CardContent>
              {invoicesQuery.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : invoices.length === 0 ? (
                <EmptyState
                  icon={Receipt}
                  title="No invoices yet"
                  description="Invoices appear here once this subscription starts billing."
                />
              ) : (
                <div className="overflow-x-auto rounded-xl border">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Issued</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-mono text-sm">
                            {invoice.invoiceNumber}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(invoice.issueDate)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(invoice.dueDate)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-medium tabular-nums">
                            {formatCurrency(invoice.total)}
                          </TableCell>
                          <TableCell>
                            <InvoiceStatus invoice={invoice} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity */}
        <TabsContent value="activity">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Activity</CardTitle>
              <CardDescription>
                Every status change, with who made it and when
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activityQuery.isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : activity.length === 0 ? (
                <EmptyState
                  icon={RefreshCw}
                  title="No activity yet"
                  description="Status changes will appear here as the subscription progresses."
                />
              ) : (
                <ActivityTimeline events={activity} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notes */}
        <TabsContent value="notes">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
              <CardDescription>
                Internal notes visible to your team
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="subscription-note">Add a note</Label>
                <Textarea
                  id="subscription-note"
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  placeholder="Share context about this subscription…"
                  rows={3}
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    className="gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700"
                    disabled={!noteDraft.trim() || isSavingNote}
                    onClick={handleAddNote}
                  >
                    {isSavingNote ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <StickyNote className="h-3.5 w-3.5" />
                    )}
                    Add note
                  </Button>
                </div>
              </div>

              <div className="border-t pt-4">
                {notesQuery.isLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                  </div>
                ) : notes.length === 0 ? (
                  <EmptyState
                    icon={StickyNote}
                    title="No notes yet"
                    description="Add the first note to keep your team in the loop."
                    className="py-10"
                  />
                ) : (
                  <ul className="space-y-4">
                    {notes.map((note) => (
                      <li key={note.id} className="flex gap-3">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="bg-indigo-100 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                            {initials(note.author)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1 rounded-xl border bg-muted/20 px-3 py-2.5">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <p className="text-sm font-medium">{note.author}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(note.createdAt)} ·{" "}
                              {formatRelative(note.createdAt)}
                            </p>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                            {note.body}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Pause / close confirmation */}
      <Dialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmAction(null);
            setReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction === "pause"
                ? "Pause subscription"
                : "Close subscription"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === "pause"
                ? `Billing will be suspended for ${subscription.subscriptionNumber} until it is resumed.`
                : `This will end ${subscription.subscriptionNumber} and stop future billing. This cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="action-reason">Reason</Label>
            <Textarea
              id="action-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={
                confirmAction === "pause"
                  ? "e.g. Customer requested a temporary hold"
                  : "e.g. Customer moved to a different provider"
              }
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              The reason is recorded on the activity timeline.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isActing}
              onClick={() => {
                setConfirmAction(null);
                setReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant={confirmAction === "close" ? "destructive" : "default"}
              className={
                confirmAction === "pause"
                  ? "gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700"
                  : "gap-1.5"
              }
              disabled={!reason.trim() || isActing}
              onClick={handleConfirmAction}
            >
              {isActing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : confirmAction === "pause" ? (
                <PauseCircle className="h-4 w-4" />
              ) : (
                <Ban className="h-4 w-4" />
              )}
              {confirmAction === "pause"
                ? "Pause subscription"
                : "Close subscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
