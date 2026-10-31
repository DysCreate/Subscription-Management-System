"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { addMonths, format as formatDateFns } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronsUpDown,
  FileText,
  Info,
  Loader2,
  Plus,
  Receipt,
  Save,
  Send,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { createCustomer, getAllCustomers } from "@/lib/api/customers";
import { findApplicableDiscount, getDiscounts } from "@/lib/api/discounts";
import { getPlans } from "@/lib/api/plans";
import { getProducts } from "@/lib/api/products";
import { getQuotationTemplates } from "@/lib/api/quotation-templates";
import { createSubscription, type CreateSubscriptionInput } from "@/lib/api/subscriptions";
import { getTaxes } from "@/lib/api/taxes";
import type {
  Customer,
  Discount,
  PaymentTerms,
  Plan,
  Product,
  QuotationTemplate,
  Tax,
} from "@/types";
import { cn } from "@/lib/utils";

const lineSchema = z.object({
  productId: z.string().min(1, "Select a product"),
  variantId: z.string().optional(),
  quantity: z.coerce
    .number({ invalid_type_error: "Enter a quantity" })
    .min(1, "Quantity must be at least 1"),
  unitPrice: z.coerce
    .number({ invalid_type_error: "Enter a unit price" })
    .min(0, "Unit price cannot be negative"),
  taxId: z.string().min(1, "Select a tax rate"),
});

const subscriptionSchema = z
  .object({
    customerId: z.string().min(1, "Select a customer"),
    planId: z.string().min(1, "Select a plan"),
    templateId: z.string().optional(),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "Expiry date is required"),
    paymentTerms: z.enum(["immediate", "net_15", "net_30", "net_60"]),
    lines: z.array(lineSchema).min(1, "Add at least one order line"),
  })
  .refine(
    (data) =>
      !data.startDate ||
      !data.endDate ||
      new Date(data.endDate).getTime() >= new Date(data.startDate).getTime(),
    {
      message: "Expiry date must be on or after the start date",
      path: ["endDate"],
    },
  );

type SubscriptionFormData = z.infer<typeof subscriptionSchema>;

const customerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
  companyName: z.string().optional(),
  phone: z.string().optional(),
});

type CustomerFormData = z.infer<typeof customerSchema>;

const PAYMENT_TERMS: Array<{ value: PaymentTerms; label: string }> = [
  { value: "immediate", label: "Immediate" },
  { value: "net_15", label: "Net 15" },
  { value: "net_30", label: "Net 30" },
  { value: "net_60", label: "Net 60" },
];

const AVATAR_TONES = [
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
];

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function toneFor(value: string): string {
  const hash = value.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_TONES[hash % AVATAR_TONES.length] ?? AVATAR_TONES[0]!;
}

function newLine(): SubscriptionFormData["lines"][number] {
  return {
    productId: "",
    variantId: "",
    quantity: 1,
    unitPrice: 0,
    taxId: "tax_18",
  };
}

function toDateInput(date: Date): string {
  return formatDateFns(date, "yyyy-MM-dd");
}

export function SubscriptionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const templateFromQuery = searchParams.get("template");
  const appliedTemplateRef = React.useRef<string | null>(null);
  const submitIntentRef = React.useRef<"draft" | "quotation">("draft");
  const [submittingIntent, setSubmittingIntent] = React.useState<
    "draft" | "quotation" | null
  >(null);
  const [customerPickerOpen, setCustomerPickerOpen] = React.useState(false);
  const [createCustomerOpen, setCreateCustomerOpen] = React.useState(false);
  const [customerSearch, setCustomerSearch] = React.useState("");
  const [newCustomerName, setNewCustomerName] = React.useState("");

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
  const taxesQuery = useQuery({
    queryKey: ["taxes"],
    queryFn: getTaxes,
  });
  const discountsQuery = useQuery({
    queryKey: ["discounts"],
    queryFn: getDiscounts,
  });
  const templatesQuery = useQuery({
    queryKey: ["quotation-templates"],
    queryFn: getQuotationTemplates,
  });

  const customers = customersQuery.data ?? [];
  const plans = React.useMemo(
    () => plansQuery.data?.items ?? [],
    [plansQuery.data],
  );
  const products = React.useMemo(
    () => productsQuery.data?.items ?? [],
    [productsQuery.data],
  );
  const taxes = taxesQuery.data ?? [];
  const discounts = discountsQuery.data ?? [];
  const templates = templatesQuery.data ?? [];

  const today = React.useMemo(() => new Date(), []);

  const form = useForm<SubscriptionFormData>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      customerId: "",
      planId: "",
      templateId: "",
      startDate: toDateInput(today),
      endDate: toDateInput(addMonths(today, 12)),
      paymentTerms: "immediate",
      lines: [newLine()],
    },
    mode: "onChange",
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const watchedLines =
    useWatch({ control: form.control, name: "lines" }) ?? [];
  const selectedCustomerId = form.watch("customerId");
  const selectedPlanId = form.watch("planId");
  const selectedTemplateId = form.watch("templateId");
  const startDate = form.watch("startDate");
  const endDate = form.watch("endDate");
  const paymentTerms = form.watch("paymentTerms");

  const selectedCustomer = customers.find(
    (customer) => customer.id === selectedCustomerId,
  );
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId);
  const selectedTemplate = templates.find(
    (template) => template.id === selectedTemplateId,
  );

  const taxMap = React.useMemo(
    () => new Map(taxes.map((tax) => [tax.id, tax])),
    [taxes],
  );

  const applyTemplate = React.useCallback(
    (template: QuotationTemplate) => {
      const planId = template.planId ?? template.planIds?.[0];
      if (planId) {
        form.setValue("planId", planId, { shouldValidate: true });
      }
      form.setValue("templateId", template.id);

      const defaultTaxId = template.taxIds?.[0] ?? "tax_18";
      const lines: SubscriptionFormData["lines"] = [];

      if (template.lines && template.lines.length > 0) {
        template.lines.forEach((line) => {
          lines.push({
            productId: line.productId,
            variantId: line.variantId ?? "",
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            taxId: line.taxId ?? defaultTaxId,
          });
        });
      } else if (template.productIds && template.productIds.length > 0) {
        template.productIds.forEach((productId) => {
          const product = products.find((item) => item.id === productId);
          if (!product) return;
          const variant = product.variants[0];
          lines.push({
            productId,
            variantId: variant?.id ?? "",
            quantity: 1,
            unitPrice: product.salesPrice + (variant?.extraPrice ?? 0),
            taxId: defaultTaxId,
          });
        });
      }

      if (lines.length > 0) {
        replace(lines);
      }
      toast.success(`Template "${template.name}" applied`);
    },
    [form, products, replace],
  );

  // Prefill from ?template=<id> once the catalogue is available.
  React.useEffect(() => {
    if (!templateFromQuery) return;
    if (appliedTemplateRef.current === templateFromQuery) return;
    if (templates.length === 0 || products.length === 0) return;
    const template = templates.find((item) => item.id === templateFromQuery);
    if (!template) return;
    appliedTemplateRef.current = templateFromQuery;
    applyTemplate(template);
  }, [applyTemplate, products.length, templateFromQuery, templates]);

  const appliedDiscount = React.useMemo<Discount | undefined>(() => {
    const templateDiscounts = selectedTemplate
      ? discounts.filter((discount) =>
          selectedTemplate.discountIds?.includes(discount.id),
        )
      : [];
    const fromTemplate = findApplicableDiscount(templateDiscounts);
    return fromTemplate ?? findApplicableDiscount(discounts);
  }, [discounts, selectedTemplate]);

  const totals = React.useMemo(() => {
    const subtotal = watchedLines.reduce(
      (sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0),
      0,
    );

    const discountTotal = appliedDiscount
      ? appliedDiscount.type === "percent"
        ? subtotal * (appliedDiscount.value / 100)
        : Math.min(appliedDiscount.value, subtotal)
      : 0;

    const taxable = Math.max(subtotal - discountTotal, 0);
    const taxTotal = watchedLines.reduce((sum, line) => {
      const rate = taxMap.get(line.taxId)?.ratePercent ?? 0;
      const lineSubtotal = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
      const lineShare = subtotal > 0 ? lineSubtotal / subtotal : 0;
      return sum + taxable * lineShare * (rate / 100);
    }, 0);

    return {
      subtotal,
      discountTotal,
      taxTotal,
      total: taxable + taxTotal,
    };
  }, [appliedDiscount, taxMap, watchedLines]);

  const belowMinimumLines = watchedLines.filter(
    (line) =>
      Boolean(selectedPlan) &&
      (Number(line.quantity) || 0) < (selectedPlan?.minQuantity ?? 1),
  ).length;

  const handleProductChange = (index: number, productId: string) => {
    const product = products.find((item) => item.id === productId);
    const variant = product?.variants[0];
    form.setValue(`lines.${index}.productId`, productId, {
      shouldValidate: true,
    });
    form.setValue(`lines.${index}.variantId`, variant?.id ?? "");
    form.setValue(
      `lines.${index}.unitPrice`,
      (product?.salesPrice ?? 0) + (variant?.extraPrice ?? 0),
      { shouldValidate: true },
    );
  };

  const handleVariantChange = (index: number, variantId: string) => {
    const line = watchedLines[index];
    const product = products.find((item) => item.id === line?.productId);
    const variant = product?.variants.find((item) => item.id === variantId);
    form.setValue(`lines.${index}.variantId`, variantId);
    if (product) {
      form.setValue(
        `lines.${index}.unitPrice`,
        product.salesPrice + (variant?.extraPrice ?? 0),
        { shouldValidate: true },
      );
    }
  };

  const onSubmit = async (data: SubscriptionFormData) => {
    const status = submitIntentRef.current;
    try {
      setSubmittingIntent(status);
      const payload: CreateSubscriptionInput = {
        customerId: data.customerId,
        planId: data.planId,
        quotationTemplateId: data.templateId || undefined,
        startDate: new Date(data.startDate).toISOString(),
        endDate: new Date(data.endDate).toISOString(),
        paymentTerms: data.paymentTerms,
        status,
        discountId: appliedDiscount?.id,
        lines: data.lines.map((line) => ({
          productId: line.productId,
          variantId: line.variantId || undefined,
          planId: data.planId,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          discountValue: 0,
          taxRatePercent: taxMap.get(line.taxId)?.ratePercent ?? 0,
        })),
      };

      const created = await createSubscription(payload);
      toast.success(
        status === "quotation"
          ? `${created.subscriptionNumber} quotation sent`
          : `${created.subscriptionNumber} saved as draft`,
      );
      router.push("/subscriptions");
    } catch {
      toast.error("Could not save the subscription. Please try again.");
    } finally {
      setSubmittingIntent(null);
    }
  };

  const handleCustomerCreated = (customer: Customer) => {
    queryClient.setQueryData<Customer[]>(["customers", "all"], (old) =>
      old ? [customer, ...old] : [customer],
    );
    form.setValue("customerId", customer.id, { shouldValidate: true });
    setCreateCustomerOpen(false);
    setCustomerPickerOpen(false);
    toast.success(`${customer.name} added to the customer directory`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="icon" className="h-9 w-9">
            <Link href="/subscriptions" aria-label="Back to subscriptions">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              New subscription
            </h1>
            <p className="text-sm text-muted-foreground">
              Compose a recurring order, apply the best promotion, and quote or
              save it for later.
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="w-fit gap-1.5 border-indigo-200 bg-indigo-50/60 py-1 text-xs text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Automatic discount applied
        </Badge>
      </div>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"
      >
        <div className="space-y-6">
          {/* Card 1 — Customer & plan */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-indigo-600" />
                Customer &amp; plan
              </CardTitle>
              <CardDescription>
                Choose who the subscription is for, the recurring plan, and an
                optional starting template.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="customer">Customer *</Label>
                <div className="flex gap-2">
                  <Popover
                    open={customerPickerOpen}
                    onOpenChange={setCustomerPickerOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        id="customer"
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={customerPickerOpen}
                        className="h-10 flex-1 justify-between font-normal"
                      >
                        {selectedCustomer ? (
                          <span className="flex min-w-0 items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback
                                className={cn(
                                  "text-[10px] font-semibold",
                                  toneFor(selectedCustomer.name),
                                )}
                              >
                                {initials(selectedCustomer.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate">
                              {selectedCustomer.name}
                            </span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <Users className="h-4 w-4" />
                            Select a customer…
                          </span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[var(--radix-popover-trigger-width)] p-0"
                      align="start"
                    >
                      <Command>
                        <CommandInput
                          placeholder="Search name, company or email…"
                          value={customerSearch}
                          onValueChange={setCustomerSearch}
                        />
                        <CommandList>
                          <CommandEmpty>
                            <div className="space-y-2 px-4 py-4 text-center">
                              <p className="text-sm text-muted-foreground">
                                No customer found.
                              </p>
                              <Button
                                type="button"
                                size="sm"
                                className="gap-2"
                                onClick={() => {
                                  setNewCustomerName(customerSearch);
                                  setCustomerPickerOpen(false);
                                  setCreateCustomerOpen(true);
                                }}
                              >
                                <UserPlus className="h-4 w-4" />
                                Create customer
                              </Button>
                            </div>
                          </CommandEmpty>
                          <CommandGroup heading="Customers">
                            {customers.map((customer) => (
                              <CommandItem
                                key={customer.id}
                                value={`${customer.name} ${customer.companyName ?? ""} ${customer.email}`}
                                onSelect={() => {
                                  form.setValue("customerId", customer.id, {
                                    shouldValidate: true,
                                  });
                                  setCustomerPickerOpen(false);
                                }}
                                className="cursor-pointer gap-2"
                              >
                                <Avatar className="h-7 w-7">
                                  <AvatarFallback
                                    className={cn(
                                      "text-[10px] font-semibold",
                                      toneFor(customer.name),
                                    )}
                                  >
                                    {initials(customer.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="flex min-w-0 flex-col">
                                  <span className="truncate text-sm font-medium">
                                    {customer.name}
                                  </span>
                                  <span className="truncate text-xs text-muted-foreground">
                                    {customer.companyName ?? customer.email}
                                  </span>
                                </span>
                                <Check
                                  className={cn(
                                    "ml-auto h-4 w-4 text-indigo-600",
                                    selectedCustomerId === customer.id
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                      <div className="border-t p-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start gap-2 text-indigo-600 hover:text-indigo-700"
                          onClick={() => {
                            setNewCustomerName(customerSearch);
                            setCustomerPickerOpen(false);
                            setCreateCustomerOpen(true);
                          }}
                        >
                          <UserPlus className="h-4 w-4" />
                          Create new customer
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 gap-2"
                    onClick={() => {
                      setNewCustomerName("");
                      setCreateCustomerOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    New
                  </Button>
                </div>
                {form.formState.errors.customerId && (
                  <p className="text-xs font-medium text-destructive">
                    {form.formState.errors.customerId.message}
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="plan">Plan *</Label>
                  <Select
                    value={selectedPlanId}
                    onValueChange={(value) => {
                      form.setValue("planId", value, { shouldValidate: true });
                    }}
                  >
                    <SelectTrigger id="plan">
                      <SelectValue placeholder="Select a recurring plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedPlan && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Info className="h-3.5 w-3.5" />
                      Billed {selectedPlan.billingPeriod} · minimum{" "}
                      {selectedPlan.minQuantity}{" "}
                      {selectedPlan.minQuantity === 1 ? "unit" : "units"}
                    </p>
                  )}
                  {form.formState.errors.planId && (
                    <p className="text-xs font-medium text-destructive">
                      {form.formState.errors.planId.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template">Start from template</Label>
                  <Select
                    value={selectedTemplateId || "none"}
                    onValueChange={(value) => {
                      if (value === "none") {
                        form.setValue("templateId", "");
                        return;
                      }
                      const template = templates.find(
                        (item) => item.id === value,
                      );
                      if (template) applyTemplate(template);
                    }}
                  >
                    <SelectTrigger id="template">
                      <SelectValue placeholder="No template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No template</SelectItem>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Prefills order lines, plan, tax and preferred promotion.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2 — Schedule & payment terms */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarDays className="h-5 w-5 text-indigo-600" />
                Schedule &amp; payment terms
              </CardTitle>
              <CardDescription>
                Set the contract window and when invoices fall due.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  {...form.register("startDate")}
                />
                {form.formState.errors.startDate && (
                  <p className="text-xs font-medium text-destructive">
                    {form.formState.errors.startDate.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Expiry date *</Label>
                <Input id="endDate" type="date" {...form.register("endDate")} />
                {form.formState.errors.endDate && (
                  <p className="text-xs font-medium text-destructive">
                    {form.formState.errors.endDate.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentTerms">Payment terms</Label>
                <Select
                  value={paymentTerms}
                  onValueChange={(value) =>
                    form.setValue(
                      "paymentTerms",
                      value as PaymentTerms,
                      { shouldValidate: true },
                    )
                  }
                >
                  <SelectTrigger id="paymentTerms">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS.map((term) => (
                      <SelectItem key={term.value} value={term.value}>
                        {term.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.paymentTerms && (
                  <p className="text-xs font-medium text-destructive">
                    {form.formState.errors.paymentTerms.message}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card 3 — Order lines */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1.5">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Receipt className="h-5 w-5 text-indigo-600" />
                  Order lines
                </CardTitle>
                <CardDescription>
                  Quantities below the plan minimum are flagged before you send
                  the quotation.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit gap-1.5"
                onClick={() => append(newLine())}
              >
                <Plus className="h-3.5 w-3.5" />
                Add line
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {form.formState.errors.lines?.message && (
                <p className="text-xs font-medium text-destructive">
                  {form.formState.errors.lines.message}
                </p>
              )}

              <div className="overflow-x-auto rounded-xl border">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="min-w-[190px]">Product</TableHead>
                      <TableHead className="min-w-[150px]">Variant</TableHead>
                      <TableHead className="w-[110px]">Quantity</TableHead>
                      <TableHead className="w-[140px]">Unit price</TableHead>
                      <TableHead className="min-w-[150px]">Tax</TableHead>
                      <TableHead className="w-[120px] text-right">
                        Amount
                      </TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field, index) => {
                      const line = watchedLines[index] ?? newLine();
                      const product = products.find(
                        (item) => item.id === line.productId,
                      );
                      const quantity = Number(line.quantity) || 0;
                      const unitPrice = Number(line.unitPrice) || 0;
                      const belowMinimum =
                        Boolean(selectedPlan) &&
                        quantity < (selectedPlan?.minQuantity ?? 1);

                      return (
                        <TableRow key={field.id} className="align-top">
                          <TableCell>
                            <Select
                              value={line.productId}
                              onValueChange={(value) =>
                                handleProductChange(index, value)
                              }
                            >
                              <SelectTrigger
                                aria-label={`Product for line ${index + 1}`}
                              >
                                <SelectValue placeholder="Select product" />
                              </SelectTrigger>
                              <SelectContent>
                                {products.map((item) => (
                                  <SelectItem key={item.id} value={item.id}>
                                    {item.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {form.formState.errors.lines?.[index]?.productId && (
                              <p className="mt-1 text-[11px] font-medium text-destructive">
                                {
                                  form.formState.errors.lines[index]?.productId
                                    ?.message
                                }
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={line.variantId || "none"}
                              onValueChange={(value) =>
                                handleVariantChange(
                                  index,
                                  value === "none" ? "" : value,
                                )
                              }
                              disabled={!product || product.variants.length === 0}
                            >
                              <SelectTrigger
                                aria-label={`Variant for line ${index + 1}`}
                              >
                                <SelectValue placeholder="No variant" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No variant</SelectItem>
                                {product?.variants.map((variant) => (
                                  <SelectItem key={variant.id} value={variant.id}>
                                    {variant.attribute} = {variant.value} (+
                                    {formatCurrency(variant.extraPrice)})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              className={cn(
                                "font-mono",
                                belowMinimum &&
                                  "border-amber-400 focus-visible:ring-amber-400",
                              )}
                              aria-label={`Quantity for line ${index + 1}`}
                              {...form.register(`lines.${index}.quantity`)}
                            />
                            {belowMinimum && (
                              <p className="mt-1 flex items-start gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                                Below plan minimum ({selectedPlan?.minQuantity})
                              </p>
                            )}
                            {form.formState.errors.lines?.[index]?.quantity && (
                              <p className="mt-1 text-[11px] font-medium text-destructive">
                                {
                                  form.formState.errors.lines[index]?.quantity
                                    ?.message
                                }
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="relative">
                              <span className="absolute left-2.5 top-2.5 text-xs font-semibold text-muted-foreground">
                                ₹
                              </span>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                className="pl-6 font-mono"
                                aria-label={`Unit price for line ${index + 1}`}
                                {...form.register(`lines.${index}.unitPrice`)}
                              />
                            </div>
                            {form.formState.errors.lines?.[index]?.unitPrice && (
                              <p className="mt-1 text-[11px] font-medium text-destructive">
                                {
                                  form.formState.errors.lines[index]?.unitPrice
                                    ?.message
                                }
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={line.taxId}
                              onValueChange={(value) =>
                                form.setValue(`lines.${index}.taxId`, value, {
                                  shouldValidate: true,
                                })
                              }
                            >
                              <SelectTrigger
                                aria-label={`Tax for line ${index + 1}`}
                              >
                                <SelectValue placeholder="Tax" />
                              </SelectTrigger>
                              <SelectContent>
                                {taxes.map((tax) => (
                                  <SelectItem key={tax.id} value={tax.id}>
                                    {tax.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {form.formState.errors.lines?.[index]?.taxId && (
                              <p className="mt-1 text-[11px] font-medium text-destructive">
                                {
                                  form.formState.errors.lines[index]?.taxId
                                    ?.message
                                }
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-mono text-sm font-semibold tabular-nums">
                              {formatCurrency(quantity * unitPrice)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-rose-600"
                              onClick={() => {
                                if (fields.length === 1) {
                                  toast.info("A subscription needs at least one line");
                                  return;
                                }
                                remove(index);
                              }}
                              aria-label={`Remove line ${index + 1}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {fields.length} line{fields.length === 1 ? "" : "s"} · unit
                  prices exclude taxes
                </span>
                {belowMinimumLines > 0 && (
                  <span className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {belowMinimumLines} line{belowMinimumLines === 1 ? "" : "s"}{" "}
                    below the plan minimum
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sticky summary */}
        <aside className="xl:sticky xl:top-6 xl:self-start">
          <Card className="overflow-hidden border-indigo-200/70 shadow-sm dark:border-indigo-950">
            <CardHeader className="border-b bg-gradient-to-br from-indigo-50/70 via-card to-card pb-4 dark:from-indigo-950/30">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-indigo-600" />
                Subscription summary
              </CardTitle>
              <CardDescription>
                Live totals for one billing cycle
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div className="flex items-center gap-2.5 rounded-xl border bg-muted/30 p-3">
                {selectedCustomer ? (
                  <Avatar className="h-9 w-9">
                    <AvatarFallback
                      className={cn(
                        "text-[11px] font-semibold",
                        toneFor(selectedCustomer.name),
                      )}
                    >
                      {initials(selectedCustomer.name)}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {selectedCustomer?.name ?? "Customer not selected"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {selectedPlan?.name ?? "Plan not selected"}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(totals.subtotal)}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">
                    Discount
                    {appliedDiscount && (
                      <span className="mt-0.5 block text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        {appliedDiscount.name ?? appliedDiscount.code}
                        {" · "}
                        {appliedDiscount.type === "percent"
                          ? `${appliedDiscount.value}% off`
                          : `${formatCurrency(appliedDiscount.value)} off`}
                      </span>
                    )}
                  </span>
                  <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                    − {formatCurrency(totals.discountTotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Taxes</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(totals.taxTotal)}
                  </span>
                </div>
              </div>

              <div className="flex items-end justify-between border-t pt-4">
                <div>
                  <p className="text-sm font-medium">Total per cycle</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedTemplate
                      ? "Template pricing applied"
                      : "Includes applied taxes"}
                  </p>
                </div>
                <p className="font-mono text-2xl font-bold tabular-nums tracking-tight">
                  {formatCurrency(totals.total)}
                </p>
              </div>

              <div className="space-y-1.5 rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">
                <p className="flex items-center justify-between gap-2">
                  <span>Start</span>
                  <span className="font-medium text-foreground">
                    {startDate ? formatDate(startDate) : "—"}
                  </span>
                </p>
                <p className="flex items-center justify-between gap-2">
                  <span>Expiry</span>
                  <span className="font-medium text-foreground">
                    {endDate ? formatDate(endDate) : "—"}
                  </span>
                </p>
                <p className="flex items-center justify-between gap-2">
                  <span>Payment terms</span>
                  <span className="font-medium text-foreground">
                    {PAYMENT_TERMS.find((term) => term.value === paymentTerms)
                      ?.label ?? "—"}
                  </span>
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <Button
                  type="submit"
                  variant="outline"
                  className="h-10 w-full gap-2"
                  disabled={submittingIntent !== null}
                  onClick={() => {
                    submitIntentRef.current = "draft";
                  }}
                >
                  {submittingIntent === "draft" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save as draft
                </Button>
                <Button
                  type="submit"
                  className="h-10 w-full gap-2 bg-indigo-600 text-white hover:bg-indigo-700"
                  disabled={submittingIntent !== null}
                  onClick={() => {
                    submitIntentRef.current = "quotation";
                  }}
                >
                  {submittingIntent === "quotation" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Send quotation
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => router.push("/subscriptions")}
                  disabled={submittingIntent !== null}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </aside>
      </form>

      <QuickCreateCustomerDialog
        open={createCustomerOpen}
        onOpenChange={setCreateCustomerOpen}
        defaultName={newCustomerName}
        onCreated={handleCustomerCreated}
      />
    </div>
  );
}

interface QuickCreateCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName?: string;
  onCreated: (customer: Customer) => void;
}

function QuickCreateCustomerDialog({
  open,
  onOpenChange,
  defaultName,
  onCreated,
}: QuickCreateCustomerDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: defaultName ?? "",
      email: "",
      companyName: "",
      phone: "",
    },
    mode: "onChange",
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        name: defaultName ?? "",
        email: "",
        companyName: "",
        phone: "",
      });
    }
  }, [defaultName, form, open]);

  const onSubmit = async (data: CustomerFormData) => {
    try {
      setIsSubmitting(true);
      const customer = await createCustomer({
        name: data.name,
        email: data.email,
        companyName: data.companyName || undefined,
        phone: data.phone || undefined,
      });
      onCreated(customer);
      form.reset();
    } catch {
      toast.error("Could not create the customer");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick create customer</DialogTitle>
          <DialogDescription>
            Add a billing contact without leaving this quotation. They will be
            selected automatically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quick-name">Full name *</Label>
            <Input
              id="quick-name"
              placeholder="e.g. Ananya Nair"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-xs font-medium text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="quick-email">Email *</Label>
            <Input
              id="quick-email"
              type="email"
              placeholder="billing@company.com"
              {...form.register("email")}
            />
            {form.formState.errors.email && (
              <p className="text-xs font-medium text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="quick-company">Company</Label>
              <Input
                id="quick-company"
                placeholder="Company name"
                {...form.register("companyName")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-phone">Phone</Label>
              <Input
                id="quick-phone"
                placeholder="+91 98470 00000"
                {...form.register("phone")}
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="gap-2 bg-indigo-600 text-white hover:bg-indigo-700"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Create customer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
