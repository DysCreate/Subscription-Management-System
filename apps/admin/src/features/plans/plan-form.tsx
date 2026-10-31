"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  ArrowLeft,
  Calendar,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  Info,
  Layers,
  Loader2,
  RefreshCw,
  Save,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  calculateAnnualizedAmount,
  calculateNextInvoiceDates,
  createPlan,
  updatePlan,
} from "@/lib/api/plans";
import type { BillingPeriod, Plan } from "@/types";
import { cn } from "@/lib/utils";

const planFormSchema = z
  .object({
    name: z.string().min(2, "Plan name must be at least 2 characters"),
    price: z.coerce.number().min(0, "Price cannot be negative"),
    billingPeriod: z.enum(["daily", "weekly", "monthly", "yearly"]),
    minQuantity: z.coerce.number().min(1, "Minimum quantity must be at least 1"),
    availableFrom: z.string().optional(),
    availableTo: z.string().optional(),
    autoClose: z.boolean().default(false),
    closable: z.boolean().default(true),
    pausable: z.boolean().default(true),
    renewable: z.boolean().default(true),
  })
  .refine(
    (data) => {
      if (data.availableFrom && data.availableTo) {
        return new Date(data.availableTo) >= new Date(data.availableFrom);
      }
      return true;
    },
    {
      message: "End date ('Available to') must be on or after start date ('Available from')",
      path: ["availableTo"],
    },
  );

type PlanFormData = z.infer<typeof planFormSchema>;

export interface PlanFormProps {
  initialPlan?: Plan;
}

const PERIOD_OPTIONS: { label: string; value: BillingPeriod }[] = [
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Yearly", value: "yearly" },
];

export function PlanForm({ initialPlan }: PlanFormProps) {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const isEditing = Boolean(initialPlan);

  const form = useForm<PlanFormData>({
    resolver: zodResolver(planFormSchema),
    defaultValues: {
      name: initialPlan?.name || "",
      price: initialPlan?.price ?? 0,
      billingPeriod: initialPlan?.billingPeriod || "monthly",
      minQuantity: initialPlan?.minQuantity ?? 1,
      availableFrom: initialPlan?.availableFrom || "",
      availableTo: initialPlan?.availableTo || "",
      autoClose: initialPlan?.autoClose ?? false,
      closable: initialPlan?.closable ?? true,
      pausable: initialPlan?.pausable ?? true,
      renewable: initialPlan?.renewable ?? true,
    },
    mode: "onChange",
  });

  const price = form.watch("price") || 0;
  const billingPeriod = form.watch("billingPeriod");
  const minQuantity = form.watch("minQuantity") || 1;
  const availableFrom = form.watch("availableFrom");
  const availableTo = form.watch("availableTo");
  const autoClose = form.watch("autoClose");
  const closable = form.watch("closable");
  const pausable = form.watch("pausable");
  const renewable = form.watch("renewable");

  // Calculated next 3 invoice dates
  const nextInvoiceDates = React.useMemo(() => {
    return calculateNextInvoiceDates(billingPeriod, availableFrom, 3);
  }, [billingPeriod, availableFrom]);

  // Annualized amount
  const annualizedAmount = React.useMemo(() => {
    return calculateAnnualizedAmount(Number(price), billingPeriod);
  }, [price, billingPeriod]);

  // Dynamic live summary sentence
  const summarySentence = React.useMemo(() => {
    const periodLabel =
      billingPeriod === "daily"
        ? "day"
        : billingPeriod === "weekly"
          ? "week"
          : billingPeriod === "monthly"
            ? "month"
            : "year";

    const parts: string[] = [
      `Billed ${formatCurrency(Number(price))} every ${periodLabel} with a minimum order of ${minQuantity} ${
        minQuantity === 1 ? "unit" : "units"
      }.`,
    ];

    if (availableFrom && availableTo) {
      parts.push(
        `Available from ${formatDate(availableFrom)} until ${formatDate(availableTo)}.`,
      );
    } else if (availableFrom) {
      parts.push(`Available starting ${formatDate(availableFrom)}.`);
    } else if (availableTo) {
      parts.push(`Available until ${formatDate(availableTo)}.`);
    } else {
      parts.push("Available indefinitely.");
    }

    const behaviors: string[] = [];
    if (closable) behaviors.push("can be closed early");
    if (pausable) behaviors.push("can be paused");
    if (renewable) behaviors.push("renews automatically");
    if (autoClose) behaviors.push("auto-closes at validity conclusion");

    if (behaviors.length > 0) {
      const formattedBehaviors =
        behaviors.slice(0, -1).join(", ") +
        (behaviors.length > 1 ? " and " : "") +
        behaviors.slice(-1);
      parts.push(`Subscriptions on this plan ${formattedBehaviors}.`);
    }

    return parts.join(" ");
  }, [
    price,
    billingPeriod,
    minQuantity,
    availableFrom,
    availableTo,
    closable,
    pausable,
    renewable,
    autoClose,
  ]);

  const onSubmit = async (data: PlanFormData) => {
    if (!isAdmin) {
      toast.error("Staff members have read-only permissions");
      return;
    }

    try {
      setIsSubmitting(true);
      if (isEditing && initialPlan) {
        await updatePlan(initialPlan.id, {
          name: data.name,
          price: data.price,
          billingPeriod: data.billingPeriod,
          minQuantity: data.minQuantity,
          availableFrom: data.availableFrom || undefined,
          availableTo: data.availableTo || undefined,
          autoClose: data.autoClose,
          closable: data.closable,
          pausable: data.pausable,
          renewable: data.renewable,
        });
        toast.success("Plan updated successfully");
      } else {
        await createPlan({
          name: data.name,
          price: data.price,
          billingPeriod: data.billingPeriod,
          minQuantity: data.minQuantity,
          availableFrom: data.availableFrom || undefined,
          availableTo: data.availableTo || undefined,
          autoClose: data.autoClose,
          closable: data.closable,
          pausable: data.pausable,
          renewable: data.renewable,
          isActive: true,
        });
        toast.success("Plan created successfully");
      }
      router.push("/plans");
    } catch {
      toast.error("Failed to save plan");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="icon" className="h-9 w-9">
            <Link href="/plans" aria-label="Back to plans list">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isEditing ? `Edit ${initialPlan?.name}` : "Create Billing Plan"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Define recurring billing cadences, availability schedule, and subscription rules.
            </p>
          </div>
        </div>

        {!isAdmin && (
          <Badge variant="outline" className="gap-1.5 py-1 text-xs">
            <Info className="h-3.5 w-3.5 text-amber-500" />
            Staff Mode: Read-Only
          </Badge>
        )}
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Form Fields (2 columns wide) */}
          <div className="space-y-6 lg:col-span-2">
            {/* Core Plan Details Card */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Layers className="h-5 w-5 text-indigo-600" />
                  Plan Parameters
                </CardTitle>
                <CardDescription>
                  Configure billing frequency, base price, and order thresholds
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Plan Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="name">Plan Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g. Enterprise Monthly Growth"
                    disabled={!isAdmin || isSubmitting}
                    {...form.register("name")}
                  />
                  {form.formState.errors.name && (
                    <p className="text-xs font-medium text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>

                {/* Billing Period Segmented Control */}
                <div className="space-y-2 pt-1">
                  <Label className="text-sm">Billing Period *</Label>
                  <div className="grid grid-cols-4 gap-2 rounded-xl bg-muted/60 p-1.5 border border-border/50">
                    {PERIOD_OPTIONS.map((opt) => {
                      const isSelected = billingPeriod === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={!isAdmin || isSubmitting}
                          onClick={() => form.setValue("billingPeriod", opt.value)}
                          className={cn(
                            "flex items-center justify-center rounded-lg py-2 text-xs font-semibold transition-all duration-150 focus:outline-none",
                            isSelected
                              ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Price & Min Quantity */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="price">Recurring Price (INR) *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-sm text-muted-foreground font-semibold">
                        ₹
                      </span>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className="pl-7 font-mono"
                        disabled={!isAdmin || isSubmitting}
                        {...form.register("price")}
                      />
                    </div>
                    {form.formState.errors.price && (
                      <p className="text-xs font-medium text-destructive">
                        {form.formState.errors.price.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="minQuantity">Minimum Quantity *</Label>
                    <Input
                      id="minQuantity"
                      type="number"
                      min="1"
                      placeholder="1"
                      className="font-mono"
                      disabled={!isAdmin || isSubmitting}
                      {...form.register("minQuantity")}
                    />
                    {form.formState.errors.minQuantity && (
                      <p className="text-xs font-medium text-destructive">
                        {form.formState.errors.minQuantity.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Availability Dates (From / To) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="availableFrom">Available From</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="availableFrom"
                        type="date"
                        className="pl-9"
                        disabled={!isAdmin || isSubmitting}
                        {...form.register("availableFrom")}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="availableTo">Available To</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="availableTo"
                        type="date"
                        className="pl-9"
                        disabled={!isAdmin || isSubmitting}
                        {...form.register("availableTo")}
                      />
                    </div>
                    {form.formState.errors.availableTo && (
                      <p className="text-xs font-medium text-destructive">
                        {form.formState.errors.availableTo.message}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Behavior Switches Card (4 switches) */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-indigo-600" />
                  Subscription Lifecycle Rules
                </CardTitle>
                <CardDescription>
                  Determine customer self-service actions and plan termination policies
                </CardDescription>
              </CardHeader>

              <CardContent className="divide-y divide-border/60">
                {/* Switch 1: Auto-close */}
                <div className="flex items-center justify-between py-3">
                  <div className="space-y-0.5 pr-4">
                    <Label htmlFor="autoClose" className="text-sm font-medium">
                      Auto-close when plan ends
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically terminate active contracts once the validity window passes.
                    </p>
                  </div>
                  <Switch
                    id="autoClose"
                    checked={autoClose}
                    onCheckedChange={(val) => form.setValue("autoClose", val)}
                    disabled={!isAdmin || isSubmitting}
                  />
                </div>

                {/* Switch 2: Closable */}
                <div className="flex items-center justify-between py-3">
                  <div className="space-y-0.5 pr-4">
                    <Label htmlFor="closable" className="text-sm font-medium">
                      Can be closed early
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Allow customers and staff to cancel before the full billing term completes.
                    </p>
                  </div>
                  <Switch
                    id="closable"
                    checked={closable}
                    onCheckedChange={(val) => form.setValue("closable", val)}
                    disabled={!isAdmin || isSubmitting}
                  />
                </div>

                {/* Switch 3: Pausable */}
                <div className="flex items-center justify-between py-3">
                  <div className="space-y-0.5 pr-4">
                    <Label htmlFor="pausable" className="text-sm font-medium">
                      Can be paused
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Permit customer to pause billing cycles temporarily without cancellation.
                    </p>
                  </div>
                  <Switch
                    id="pausable"
                    checked={pausable}
                    onCheckedChange={(val) => form.setValue("pausable", val)}
                    disabled={!isAdmin || isSubmitting}
                  />
                </div>

                {/* Switch 4: Renewable */}
                <div className="flex items-center justify-between py-3">
                  <div className="space-y-0.5 pr-4">
                    <Label htmlFor="renewable" className="text-sm font-medium">
                      Can be renewed
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Enable automatic rollover to the next cycle upon invoice settlement.
                    </p>
                  </div>
                  <Switch
                    id="renewable"
                    checked={renewable}
                    onCheckedChange={(val) => form.setValue("renewable", val)}
                    disabled={!isAdmin || isSubmitting}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Live Summary & Billing Preview */}
          <div className="space-y-6">
            {/* Live Summary Sentence Card */}
            <Card className="shadow-sm border-indigo-200 dark:border-indigo-950/70 bg-gradient-to-b from-indigo-50/40 via-card to-card dark:from-indigo-950/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-indigo-900 dark:text-indigo-200">
                  <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  Live Plan Summary
                </CardTitle>
                <CardDescription>
                  Synthesized policy statement generated in real time
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-xl border border-indigo-100 bg-white/70 p-4 text-xs leading-relaxed text-foreground shadow-sm dark:border-indigo-950 dark:bg-card">
                  {summarySentence}
                </div>

                {/* Behavioral chips preview */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {autoClose && (
                    <Badge variant="outline" className="text-[10px] bg-background">
                      Auto-close
                    </Badge>
                  )}
                  {closable && (
                    <Badge variant="outline" className="text-[10px] bg-background">
                      Closable
                    </Badge>
                  )}
                  {pausable && (
                    <Badge variant="outline" className="text-[10px] bg-background">
                      Pausable
                    </Badge>
                  )}
                  {renewable && (
                    <Badge variant="outline" className="text-[10px] bg-background">
                      Renewable
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Billing Preview: Next 3 Invoices & Annualized Revenue */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-indigo-600" />
                  Billing Preview
                </CardTitle>
                <CardDescription>
                  Next scheduled renewals and run-rate projections
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Annualized Run-Rate Metric */}
                <div className="rounded-xl border bg-muted/40 p-4 space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Annualized Contract Value
                  </span>
                  <div className="text-2xl font-extrabold text-foreground font-mono tracking-tight">
                    {formatCurrency(annualizedAmount)}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Based on 1 unit billed {billingPeriod}
                  </p>
                </div>

                {/* Next 3 Invoice Dates */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5 text-indigo-600" />
                    Next 3 Scheduled Invoices
                  </span>

                  <div className="space-y-1.5 text-xs">
                    {nextInvoiceDates.map((date, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                            #{index + 1}
                          </span>
                          <span className="font-medium text-foreground">
                            {formatDate(date)}
                          </span>
                        </div>
                        <span className="font-mono text-muted-foreground font-semibold">
                          {formatCurrency(Number(price))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Action Footer */}
        {isAdmin && (
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button asChild variant="outline" type="button" disabled={isSubmitting}>
              <Link href="/plans">Cancel</Link>
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving Plan...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {isEditing ? "Update Plan" : "Create Plan"}
                </>
              )}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
