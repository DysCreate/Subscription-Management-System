"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { getAllCustomers } from "@/lib/api/customers";
import type { InvoiceRecord } from "@/lib/api/invoices";
import {
  getOutstandingInvoices,
  recordPayment,
  type RecordPaymentResult,
} from "@/lib/api/payments";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Customer, PaymentMethod } from "@/types";
import {
  PAYMENT_METHOD_OPTIONS,
  paymentMethodLabel,
} from "./payment-methods";

const paymentSchema = z.object({
  invoiceId: z.string().min(1, "Select an invoice to pay"),
  method: z.enum(["card", "bank_transfer", "upi", "cash", "cheque"]),
  amount: z.coerce
    .number({ invalid_type_error: "Enter a valid amount" })
    .positive("Amount must be greater than zero"),
  paidAt: z.string().min(1, "Choose the payment date"),
  notes: z
    .string()
    .max(280, "Note must be 280 characters or fewer")
    .optional(),
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

export interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the invoice (and its balance) is prefilled. */
  invoice?: InvoiceRecord | null;
  onRecorded?: (result: RecordPaymentResult) => void;
}

function todayInputValue(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function toIsoTimestamp(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString();
}

/**
 * Reusable full/partial payment recorder.
 * Opens from the invoice detail page (prefilled) and the payments worklist.
 */
export function RecordPaymentDialog({
  open,
  onOpenChange,
  invoice,
  onRecorded,
}: RecordPaymentDialogProps) {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = React.useState(false);
  const [invoicePickerOpen, setInvoicePickerOpen] = React.useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    watch,
    reset,
    formState: { errors },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      invoiceId: "",
      method: "upi",
      amount: 0,
      paidAt: todayInputValue(),
      notes: "",
    },
  });

  const outstandingQuery = useQuery({
    queryKey: ["outstanding-invoices"],
    queryFn: getOutstandingInvoices,
    enabled: open,
  });

  const customersQuery = useQuery({
    queryKey: ["customers", "all"],
    queryFn: getAllCustomers,
    enabled: open,
  });

  const invoices = React.useMemo<InvoiceRecord[]>(() => {
    const list = outstandingQuery.data ?? [];
    if (invoice && !list.some((item) => item.id === invoice.id)) {
      return [invoice, ...list];
    }
    return list;
  }, [outstandingQuery.data, invoice]);

  const customerMap = React.useMemo(
    () =>
      new Map<string, Customer>(
        (customersQuery.data ?? []).map((customer) => [
          customer.id,
          customer,
        ]),
      ),
    [customersQuery.data],
  );

  React.useEffect(() => {
    if (!open) return;
    reset({
      invoiceId: invoice?.id ?? "",
      method: "upi",
      amount: invoice?.balance ?? 0,
      paidAt: todayInputValue(),
      notes: "",
    });
  }, [open, invoice, reset]);

  const selectedInvoiceId = watch("invoiceId");
  const selectedMethod = watch("method");
  const watchedAmount = watch("amount");
  const selectedInvoice =
    invoices.find((item) => item.id === selectedInvoiceId) ??
    (invoice?.id === selectedInvoiceId ? invoice : undefined);
  const selectedCustomer = selectedInvoice
    ? customerMap.get(selectedInvoice.customerId)
    : undefined;

  const amount = Number(watchedAmount);
  const validAmount = Number.isFinite(amount) && amount > 0;
  const balance = selectedInvoice?.balance ?? 0;
  const remaining = selectedInvoice
    ? Math.max(balance - (validAmount ? amount : 0), 0)
    : 0;
  const exceedsBalance =
    Boolean(selectedInvoice) && validAmount && amount > balance + 0.005;
  const willSettle =
    Boolean(selectedInvoice) && validAmount && amount >= balance - 0.005;

  const handleSelectInvoice = (next: InvoiceRecord) => {
    setValue("invoiceId", next.id, { shouldValidate: true });
    setValue("amount", next.balance, { shouldValidate: true });
    clearErrors(["invoiceId", "amount"]);
    setInvoicePickerOpen(false);
  };

  const onSubmit = async (values: PaymentFormValues) => {
    const target = invoices.find(
      (item) => item.id === values.invoiceId,
    );
    if (!target) {
      setError("invoiceId", { message: "Select an invoice to pay" });
      return;
    }
    if (values.amount > target.balance + 0.005) {
      setError("amount", {
        message: `Amount cannot exceed the balance due of ${formatCurrency(
          target.balance,
        )}`,
      });
      return;
    }

    setIsSaving(true);
    try {
      const result = await recordPayment({
        invoiceId: target.id,
        amount: values.amount,
        method: values.method as PaymentMethod,
        paidAt: toIsoTimestamp(values.paidAt),
        notes: values.notes?.trim() || undefined,
        recordedBy: user?.name ?? "Aarav Menon",
      });
      toast.success(
        `${formatCurrency(result.payment.amount)} recorded for ${
          target.invoiceNumber
        } via ${paymentMethodLabel(result.payment.method)}`,
      );
      onRecorded?.(result);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not record payment",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            Capture a full or partial payment against an outstanding invoice.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 pt-1"
          noValidate
        >
          {/* Invoice combobox */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Invoice <span className="text-destructive">*</span>
            </Label>
            <Popover
              open={invoicePickerOpen}
              onOpenChange={setInvoicePickerOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={invoicePickerOpen}
                  aria-invalid={Boolean(errors.invoiceId)}
                  className={cn(
                    "h-auto min-h-10 w-full justify-between px-3 py-2 font-normal",
                    !selectedInvoice && "text-muted-foreground",
                    errors.invoiceId && "border-destructive",
                  )}
                >
                  {selectedInvoice ? (
                    <span className="min-w-0 flex-1 text-left">
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-foreground">
                          {selectedInvoice.invoiceNumber}
                        </span>
                        <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                          {formatCurrency(selectedInvoice.balance)} due
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {selectedCustomer?.name ?? "Unknown customer"}
                        {selectedCustomer?.companyName
                          ? ` · ${selectedCustomer.companyName}`
                          : ""}
                      </span>
                    </span>
                  ) : (
                    <span className="text-sm">
                      Search and select an outstanding invoice
                    </span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-[var(--radix-popover-trigger-width)] p-0"
              >
                <Command>
                  <CommandInput placeholder="Search invoice or customer…" />
                  <CommandList>
                    {outstandingQuery.isLoading ? (
                      <div className="space-y-2 p-3">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    ) : (
                      <>
                        <CommandEmpty>
                          No outstanding invoices found.
                        </CommandEmpty>
                        <CommandGroup heading="Outstanding invoices">
                          {invoices.map((option) => {
                            const customer = customerMap.get(
                              option.customerId,
                            );
                            return (
                              <CommandItem
                                key={option.id}
                                value={`${option.invoiceNumber} ${
                                  customer?.name ?? ""
                                } ${customer?.companyName ?? ""}`}
                                onSelect={() => handleSelectInvoice(option)}
                                className="gap-2"
                              >
                                <span className="min-w-0 flex-1">
                                  <span className="block font-mono text-xs font-semibold">
                                    {option.invoiceNumber}
                                  </span>
                                  <span className="block truncate text-xs text-muted-foreground">
                                    {customer?.name ?? "Unknown customer"}
                                  </span>
                                </span>
                                <span className="shrink-0 text-right">
                                  <span className="block font-mono text-xs font-semibold tabular-nums">
                                    {formatCurrency(option.balance)}
                                  </span>
                                  <span className="block text-[10px] text-muted-foreground">
                                    due
                                  </span>
                                </span>
                                <Check
                                  className={cn(
                                    "h-4 w-4 text-indigo-600",
                                    option.id === selectedInvoiceId
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {errors.invoiceId && (
              <p className="text-[11px] font-medium text-destructive">
                {errors.invoiceId.message}
              </p>
            )}
          </div>

          {/* Method tiles */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Payment method <span className="text-destructive">*</span>
            </Label>
            <div
              role="radiogroup"
              aria-label="Payment method"
              className="grid grid-cols-2 gap-2 sm:grid-cols-3"
            >
              {PAYMENT_METHOD_OPTIONS.map((option) => {
                const Icon = option.icon;
                const active = selectedMethod === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() =>
                      setValue("method", option.value, {
                        shouldValidate: true,
                      })
                    }
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "border-indigo-500 bg-indigo-50 text-indigo-900 dark:border-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-200"
                        : "border-border bg-background text-foreground hover:bg-muted/60",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                        active
                          ? "bg-indigo-600 text-white"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold">
                        {option.label}
                      </span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {option.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Amount */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="payment-amount" className="text-xs font-medium">
                  Amount <span className="text-destructive">*</span>
                </Label>
                {selectedInvoice && (
                  <button
                    type="button"
                    className="text-[10px] font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    onClick={() =>
                      setValue("amount", selectedInvoice.balance, {
                        shouldValidate: true,
                      })
                    }
                  >
                    Full balance
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  ₹
                </span>
                <Input
                  id="payment-amount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  className="h-9 pl-7 text-sm tabular-nums"
                  aria-invalid={Boolean(errors.amount) || exceedsBalance}
                  {...register("amount", { valueAsNumber: true })}
                />
              </div>
              {selectedInvoice && !errors.amount && (
                <p className="text-[11px] text-muted-foreground">
                  Balance due {formatCurrency(selectedInvoice.balance)}
                </p>
              )}
              {exceedsBalance && !errors.amount && (
                <p className="text-[11px] font-medium text-destructive">
                  Amount cannot exceed the balance due of{" "}
                  {formatCurrency(balance)}
                </p>
              )}
              {errors.amount && (
                <p className="text-[11px] font-medium text-destructive">
                  {errors.amount.message}
                </p>
              )}
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label htmlFor="payment-date" className="text-xs font-medium">
                Payment date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="payment-date"
                type="date"
                className="h-9 text-sm"
                aria-invalid={Boolean(errors.paidAt)}
                {...register("paidAt")}
              />
              {errors.paidAt && (
                <p className="text-[11px] font-medium text-destructive">
                  {errors.paidAt.message}
                </p>
              )}
            </div>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label htmlFor="payment-note" className="text-xs font-medium">
              Note <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="payment-note"
              rows={2}
              placeholder="e.g. UPI reference, cheque number, part payment context…"
              className="resize-none text-sm"
              {...register("notes")}
            />
            {errors.notes && (
              <p className="text-[11px] font-medium text-destructive">
                {errors.notes.message}
              </p>
            )}
          </div>

          {/* Live outcome preview */}
          {selectedInvoice && validAmount && (
            <div
              className={cn(
                "rounded-lg border px-3 py-2.5 text-xs font-medium",
                exceedsBalance
                  ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                  : willSettle
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
              )}
            >
              {exceedsBalance ? (
                <>
                  Amount exceeds the balance by{" "}
                  {formatCurrency(amount - balance)}. Reduce it to{" "}
                  {formatCurrency(balance)} or less.
                </>
              ) : willSettle ? (
                <>
                  After this payment: balance {formatCurrency(0)} → invoice
                  will be marked <span className="font-semibold">Paid</span>
                </>
              ) : (
                <>
                  Partial payment: balance{" "}
                  {formatCurrency(remaining)} remains
                </>
              )}
            </div>
          )}

          <DialogFooter className="pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="gap-2 bg-indigo-600 text-white hover:bg-indigo-700"
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Record payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
