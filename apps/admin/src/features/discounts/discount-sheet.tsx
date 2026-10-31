"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Calendar,
  Check,
  CheckCircle2,
  DollarSign,
  HelpCircle,
  Loader2,
  Package,
  Percent,
  Receipt,
  Sparkles,
  Tag,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/format";
import type { DiscountInput } from "@/lib/api/discounts";
import type { Discount, DiscountScope, DiscountType, Product } from "@/types";

const discountSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters"),
    code: z
      .string()
      .trim()
      .min(2, "Code must be at least 2 characters")
      .regex(/^[A-Za-z0-9_-]+$/, "Code must be alphanumeric without spaces"),
    type: z.enum(["percent", "fixed"]),
    value: z.coerce
      .number({ invalid_type_error: "Enter a valid discount value" })
      .positive("Discount value must be greater than 0"),
    scope: z.enum(["Subscription", "Product"]),
    productIds: z.array(z.string()).default([]),
    minPurchaseAmount: z.coerce
      .number()
      .min(0, "Minimum purchase cannot be negative")
      .default(0),
    minQuantity: z.coerce
      .number()
      .min(1, "Minimum quantity must be at least 1")
      .default(1),
    validFrom: z.string().min(1, "Start date is required"),
    validTo: z.string().min(1, "End date is required"),
    maxUses: z.coerce
      .number({ invalid_type_error: "Enter maximum usages" })
      .min(1, "Usage limit must be at least 1")
      .default(100),
  })
  .superRefine((data, ctx) => {
    if (data.type === "percent" && data.value > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Percentage discount cannot exceed 100%",
        path: ["value"],
      });
    }
    if (data.validFrom && data.validTo && data.validTo < data.validFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date cannot be earlier than start date",
        path: ["validTo"],
      });
    }
    if (data.scope === "Product" && data.productIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select at least one product when scoping to specific products",
        path: ["productIds"],
      });
    }
  });

type DiscountFormValues = z.infer<typeof discountSchema>;

interface DiscountSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  discount: Discount | null;
  readOnly?: boolean;
  availableProducts: Product[];
  onSave: (values: DiscountInput) => Promise<void>;
}

export function DiscountSheet({
  open,
  onOpenChange,
  discount,
  readOnly = false,
  availableProducts,
  onSave,
}: DiscountSheetProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [sampleOrderAmount, setSampleOrderAmount] = React.useState<number>(10000);
  const [sampleOrderQty, setSampleOrderQty] = React.useState<number>(2);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<DiscountFormValues>({
    resolver: zodResolver(discountSchema),
    defaultValues: {
      name: "",
      code: "",
      type: "percent",
      value: 10,
      scope: "Subscription",
      productIds: [],
      minPurchaseAmount: 0,
      minQuantity: 1,
      validFrom: new Date().toISOString().slice(0, 10),
      validTo: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      maxUses: 100,
    },
  });

  const formValues = watch();

  React.useEffect(() => {
    if (discount) {
      reset({
        name: discount.name ?? "",
        code: discount.code,
        type: discount.type,
        value: discount.value,
        scope: discount.scope ?? "Subscription",
        productIds: discount.productIds ?? [],
        minPurchaseAmount: discount.minPurchaseAmount ?? 0,
        minQuantity: discount.minQuantity ?? 1,
        validFrom: discount.validFrom ?? new Date().toISOString().slice(0, 10),
        validTo:
          discount.validTo ??
          new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        maxUses: discount.maxUses ?? 100,
      });
    } else {
      reset({
        name: "",
        code: "",
        type: "percent",
        value: 10,
        scope: "Subscription",
        productIds: [],
        minPurchaseAmount: 0,
        minQuantity: 1,
        validFrom: new Date().toISOString().slice(0, 10),
        validTo: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        maxUses: 100,
      });
    }
  }, [discount, reset, open]);

  const toggleProduct = (productId: string) => {
    if (readOnly) return;
    const current = formValues.productIds || [];
    const exists = current.includes(productId);
    const next = exists
      ? current.filter((id) => id !== productId)
      : [...current, productId];
    setValue("productIds", next, { shouldValidate: true });
  };

  const onSubmit = async (data: DiscountFormValues) => {
    try {
      setIsSubmitting(true);
      await onSave({
        name: data.name,
        code: data.code,
        type: data.type,
        value: data.value,
        scope: data.scope,
        productIds: data.productIds,
        minPurchaseAmount: data.minPurchaseAmount,
        minQuantity: data.minQuantity,
        validFrom: data.validFrom,
        validTo: data.validTo,
        maxUses: data.maxUses,
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Worked Example Live Preview Calculations
  const meetsMinAmount = sampleOrderAmount >= (formValues.minPurchaseAmount || 0);
  const meetsMinQty = sampleOrderQty >= (formValues.minQuantity || 1);
  const conditionsMet = meetsMinAmount && meetsMinQty;

  const rawDiscount =
    formValues.type === "percent"
      ? (sampleOrderAmount * Math.min(formValues.value || 0, 100)) / 100
      : Math.min(formValues.value || 0, sampleOrderAmount);

  const calculatedDiscount = conditionsMet ? Math.round(rawDiscount) : 0;
  const netPayable = Math.max(0, sampleOrderAmount - calculatedDiscount);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto p-0 flex flex-col bg-background"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/70 sticky top-0 bg-background/95 backdrop-blur z-10">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Tag className="h-4 w-4" />
            </div>
            <div>
              <SheetTitle className="text-base font-semibold">
                {readOnly
                  ? "Discount Details (Staff View)"
                  : discount
                  ? "Edit Discount Rule"
                  : "Create Discount Rule"}
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Define promotional coupon codes, eligibility conditions, and redemption limits.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 px-6 py-5 space-y-6">
          {readOnly && (
            <div className="p-3 rounded-lg border border-indigo-200 bg-indigo-50/60 dark:border-indigo-900/40 dark:bg-indigo-950/20 text-xs text-indigo-700 dark:text-indigo-300">
              You are viewing this discount code in <strong>Staff read-only</strong> mode. Creating or modifying rules requires Administrator privileges.
            </div>
          )}

          {/* Section 1: Basics */}
          <div className="space-y-3 p-4 rounded-xl border border-border/70 bg-card">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 text-[10px]">
                1
              </span>
              <span>Basics</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Name */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="disc-name" className="text-xs font-medium">
                  Promotion Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="disc-name"
                  placeholder="e.g. Diwali Mega Saver 20%"
                  disabled={readOnly}
                  className="h-9 text-xs"
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-[11px] text-destructive">{errors.name.message}</p>
                )}
              </div>

              {/* Code */}
              <div className="space-y-1.5">
                <Label htmlFor="disc-code" className="text-xs font-medium">
                  Coupon Code <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="disc-code"
                  placeholder="e.g. DIWALI20"
                  disabled={readOnly}
                  className="h-9 text-xs font-mono uppercase"
                  {...register("code")}
                />
                {errors.code && (
                  <p className="text-[11px] text-destructive">{errors.code.message}</p>
                )}
              </div>

              {/* Fixed / Percent Toggle */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Discount Type</Label>
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-muted/60 border border-border/50">
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => setValue("type", "percent", { shouldValidate: true })}
                    className={`h-7 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                      formValues.type === "percent"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Percent className="h-3 w-3" />
                    Percent (%)
                  </button>
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => setValue("type", "fixed", { shouldValidate: true })}
                    className={`h-7 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                      formValues.type === "fixed"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span>₹</span>
                    Fixed Amount
                  </button>
                </div>
              </div>

              {/* Value */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="disc-value" className="text-xs font-medium">
                  {formValues.type === "percent" ? "Discount Percentage (≤ 100%)" : "Discount Amount (₹)"}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="disc-value"
                    type="number"
                    step={formValues.type === "percent" ? "0.1" : "1"}
                    placeholder={formValues.type === "percent" ? "20" : "500"}
                    disabled={readOnly}
                    className="h-9 text-xs pr-8"
                    {...register("value")}
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-muted-foreground pointer-events-none">
                    {formValues.type === "percent" ? "%" : "₹"}
                  </span>
                </div>
                {errors.value && (
                  <p className="text-[11px] text-destructive">{errors.value.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Conditions */}
          <div className="space-y-3 p-4 rounded-xl border border-border/70 bg-card">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 text-[10px]">
                2
              </span>
              <span>Conditions & Thresholds</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Min purchase amount */}
              <div className="space-y-1.5">
                <Label htmlFor="disc-min-spend" className="text-xs font-medium">
                  Minimum Purchase Amount (₹)
                </Label>
                <Input
                  id="disc-min-spend"
                  type="number"
                  min="0"
                  placeholder="0 (No minimum)"
                  disabled={readOnly}
                  className="h-9 text-xs"
                  {...register("minPurchaseAmount")}
                />
                <p className="text-[10px] text-muted-foreground">
                  Order subtotal must equal or exceed this amount.
                </p>
                {errors.minPurchaseAmount && (
                  <p className="text-[11px] text-destructive">
                    {errors.minPurchaseAmount.message}
                  </p>
                )}
              </div>

              {/* Min quantity */}
              <div className="space-y-1.5">
                <Label htmlFor="disc-min-qty" className="text-xs font-medium">
                  Minimum Quantity
                </Label>
                <Input
                  id="disc-min-qty"
                  type="number"
                  min="1"
                  placeholder="1"
                  disabled={readOnly}
                  className="h-9 text-xs"
                  {...register("minQuantity")}
                />
                <p className="text-[10px] text-muted-foreground">
                  Total items/licenses in subscription cart.
                </p>
                {errors.minQuantity && (
                  <p className="text-[11px] text-destructive">{errors.minQuantity.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Validity */}
          <div className="space-y-3 p-4 rounded-xl border border-border/70 bg-card">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 text-[10px]">
                3
              </span>
              <span>Validity & Limits</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Start Date */}
              <div className="space-y-1.5">
                <Label htmlFor="disc-valid-from" className="text-xs font-medium">
                  Valid From
                </Label>
                <Input
                  id="disc-valid-from"
                  type="date"
                  disabled={readOnly}
                  className="h-9 text-xs"
                  {...register("validFrom")}
                />
                {errors.validFrom && (
                  <p className="text-[11px] text-destructive">{errors.validFrom.message}</p>
                )}
              </div>

              {/* End Date */}
              <div className="space-y-1.5">
                <Label htmlFor="disc-valid-to" className="text-xs font-medium">
                  Valid To
                </Label>
                <Input
                  id="disc-valid-to"
                  type="date"
                  disabled={readOnly}
                  className="h-9 text-xs"
                  {...register("validTo")}
                />
                {errors.validTo && (
                  <p className="text-[11px] text-destructive">{errors.validTo.message}</p>
                )}
              </div>

              {/* Usage limit */}
              <div className="space-y-1.5">
                <Label htmlFor="disc-max-uses" className="text-xs font-medium">
                  Usage Limit
                </Label>
                <Input
                  id="disc-max-uses"
                  type="number"
                  min="1"
                  placeholder="100"
                  disabled={readOnly}
                  className="h-9 text-xs"
                  {...register("maxUses")}
                />
                {errors.maxUses && (
                  <p className="text-[11px] text-destructive">{errors.maxUses.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Section 4: Scope */}
          <div className="space-y-3 p-4 rounded-xl border border-border/70 bg-card">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 text-[10px]">
                4
              </span>
              <span>Scope Applicability</span>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => setValue("scope", "Subscription", { shouldValidate: true })}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    formValues.scope === "Subscription"
                      ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 ring-1 ring-indigo-600"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">Whole Subscription</span>
                    {formValues.scope === "Subscription" && (
                      <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Applies discount globally across the entire quotation or invoice total.
                  </p>
                </button>

                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => setValue("scope", "Product", { shouldValidate: true })}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    formValues.scope === "Product"
                      ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 ring-1 ring-indigo-600"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">Specific Products</span>
                    {formValues.scope === "Product" && (
                      <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Restricts redemption exclusively to matching product items.
                  </p>
                </button>
              </div>

              {/* Multi-select chips for products */}
              {formValues.scope === "Product" && (
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <Label className="text-xs font-medium">
                    Select Eligible Products <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {availableProducts.map((p) => {
                      const isSelected = formValues.productIds?.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          disabled={readOnly}
                          onClick={() => toggleProduct(p.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            isSelected
                              ? "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
                              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground border border-border/60"
                          }`}
                        >
                          <Package className="h-3 w-3" />
                          <span>{p.name}</span>
                          {isSelected && <Check className="h-3 w-3 ml-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                  {errors.productIds && (
                    <p className="text-[11px] text-destructive">
                      {errors.productIds.message}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Section 5: Live Preview Card with worked example from form values */}
          <div className="p-4 rounded-xl border-2 border-dashed border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/50 via-background to-violet-50/40 dark:from-indigo-950/20 dark:to-violet-950/20 space-y-3">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-semibold text-foreground">
                  Live Preview: Worked Example
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] bg-background">
                Interactive Test Cart
              </Badge>
            </div>

            {/* Test Cart Inputs */}
            <div className="grid grid-cols-2 gap-3 bg-background/80 p-3 rounded-lg border border-border/60">
              <div>
                <span className="text-[10px] text-muted-foreground block mb-1">
                  Sample Order Amount (₹)
                </span>
                <Input
                  type="number"
                  value={sampleOrderAmount}
                  onChange={(e) => setSampleOrderAmount(Number(e.target.value) || 0)}
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block mb-1">
                  Sample Order Quantity
                </span>
                <Input
                  type="number"
                  min="1"
                  value={sampleOrderQty}
                  onChange={(e) => setSampleOrderQty(Number(e.target.value) || 1)}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            {/* Worked calculation card */}
            <div className="p-3.5 rounded-lg bg-card border border-border shadow-sm space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 tracking-wider">
                    {formValues.code || "COUPON_CODE"}
                  </span>
                  <div className="text-xs font-semibold text-foreground">
                    {formValues.name || "Untitled Discount Promotion"}
                  </div>
                </div>
                <Badge className="bg-indigo-600 hover:bg-indigo-600 text-white font-mono text-xs">
                  {formValues.type === "percent"
                    ? `${formValues.value || 0}% OFF`
                    : `₹${formValues.value || 0} OFF`}
                </Badge>
              </div>

              {/* Condition Checks */}
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-border/50">
                <div className="flex items-center gap-1.5">
                  {meetsMinAmount ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                  )}
                  <span className={meetsMinAmount ? "text-foreground" : "text-rose-600 dark:text-rose-400"}>
                    Min spend ₹{formValues.minPurchaseAmount || 0}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {meetsMinQty ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                  )}
                  <span className={meetsMinQty ? "text-foreground" : "text-rose-600 dark:text-rose-400"}>
                    Min qty: {formValues.minQuantity || 1}
                  </span>
                </div>
              </div>

              {/* Math breakdown */}
              <div className="space-y-1.5 pt-2 border-t border-border/50 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Gross Order Subtotal</span>
                  <span className="font-mono">{formatCurrency(sampleOrderAmount)}</span>
                </div>
                <div className="flex justify-between font-medium text-emerald-600 dark:text-emerald-400">
                  <span>
                    Discount Applied ({formValues.type === "percent" ? `${formValues.value}%` : "Flat"})
                  </span>
                  <span className="font-mono">-{formatCurrency(calculatedDiscount)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-border/70 font-bold text-foreground text-sm">
                  <span>Customer Net Payable</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400">
                    {formatCurrency(netPayable)}
                  </span>
                </div>
              </div>

              {conditionsMet && calculatedDiscount > 0 && (
                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/40 rounded px-2.5 py-1.5 text-[11px] text-emerald-800 dark:text-emerald-300 font-medium text-center">
                  🎉 Customer saves {formatCurrency(calculatedDiscount)} with this promotion!
                </div>
              )}
            </div>
          </div>

          <SheetFooter className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border/70 pt-3 pb-2 -mx-6 px-6">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            {!readOnly && (
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
              >
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {discount ? "Save Changes" : "Create Discount"}
              </Button>
            )}
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
