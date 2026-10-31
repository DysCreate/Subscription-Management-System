"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  FileText,
  Layers,
  Loader2,
  Package,
  Play,
  Plus,
  Save,
  ShieldAlert,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/format";
import { getPlans } from "@/lib/api/plans";
import { getProducts } from "@/lib/api/products";
import {
  createQuotationTemplate,
  getQuotationTemplateById,
  updateQuotationTemplate,
} from "@/lib/api/quotation-templates";
import type { QuotationTemplate, QuotationTemplateLine } from "@/types";

interface TemplateFormLine {
  id: string;
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface QuotationTemplateFormProps {
  templateId?: string; // If undefined, creating new
}

export function QuotationTemplateForm({ templateId }: QuotationTemplateFormProps) {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [planId, setPlanId] = React.useState("plan_01");
  const [validityDays, setValidityDays] = React.useState<number>(30);
  const [notes, setNotes] = React.useState("");
  const [lines, setLines] = React.useState<TemplateFormLine[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);

  // Load plans & products
  const { data: plansData } = useQuery({
    queryKey: ["plans"],
    queryFn: () => getPlans(),
  });
  const plans = plansData?.items ?? [];

  const { data: productsData } = useQuery({
    queryKey: ["products"],
    queryFn: () => getProducts(),
  });
  const products = productsData?.items ?? [];

  // Load template if editing
  const { data: existingTemplate, isLoading: isLoadingTemplate } = useQuery({
    queryKey: ["quotation-template", templateId],
    queryFn: () => (templateId ? getQuotationTemplateById(templateId) : undefined),
    enabled: !!templateId,
  });

  React.useEffect(() => {
    if (existingTemplate) {
      setName(existingTemplate.name);
      setDescription(existingTemplate.description ?? "");
      setPlanId(existingTemplate.planId ?? existingTemplate.planIds?.[0] ?? "plan_01");
      setValidityDays(existingTemplate.validityDays ?? 30);
      setNotes(existingTemplate.notes ?? "");

      if (existingTemplate.lines && existingTemplate.lines.length > 0) {
        setLines(
          existingTemplate.lines.map((l) => ({
            id: l.id,
            productId: l.productId,
            variantId: l.variantId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            lineTotal: l.quantity * l.unitPrice,
          })),
        );
      } else if (existingTemplate.productIds && existingTemplate.productIds.length > 0) {
        // Fallback from productIds
        setLines(
          existingTemplate.productIds.map((pid, idx) => ({
            id: `line_${idx}`,
            productId: pid,
            variantId: undefined,
            quantity: 1,
            unitPrice: 12000,
            lineTotal: 12000,
          })),
        );
      }
    } else if (!templateId && products.length > 0 && lines.length === 0) {
      // Initialize with 1 default line for new template
      const defaultProduct = products[0];
      if (defaultProduct) {
        setLines([
          {
            id: `line_${Date.now()}`,
            productId: defaultProduct.id,
            variantId: defaultProduct.variants?.[0]?.id,
            quantity: 1,
            unitPrice:
              defaultProduct.salesPrice +
              (defaultProduct.variants?.[0]?.extraPrice ?? defaultProduct.variants?.[0]?.priceDelta ?? 0),
            lineTotal:
              defaultProduct.salesPrice +
              (defaultProduct.variants?.[0]?.extraPrice ?? defaultProduct.variants?.[0]?.priceDelta ?? 0),
          },
        ]);
      }
    }
  }, [existingTemplate, templateId, products]);

  // Selected Plan Object
  const selectedPlan = plans.find((p) => p.id === planId);

  // Line Handlers
  const handleAddLine = () => {
    const defaultProduct = products[0];
    if (!defaultProduct) return;
    const variant = defaultProduct.variants?.[0];
    const unitPrice =
      defaultProduct.salesPrice + (variant?.extraPrice ?? variant?.priceDelta ?? 0);

    const newLine: TemplateFormLine = {
      id: `line_${Date.now()}`,
      productId: defaultProduct.id,
      variantId: variant?.id,
      quantity: 1,
      unitPrice,
      lineTotal: unitPrice,
    };
    setLines([...lines, newLine]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) {
      toast.warning("A quotation template must include at least one order line.");
      return;
    }
    setLines(lines.filter((_, idx) => idx !== index));
  };

  const handleProductChange = (index: number, newProductId: string) => {
    const product = products.find((p) => p.id === newProductId);
    if (!product) return;
    const variant = product.variants?.[0];
    const unitPrice =
      product.salesPrice + (variant?.extraPrice ?? variant?.priceDelta ?? 0);

    setLines(
      lines.map((l, idx) => {
        if (idx !== index) return l;
        return {
          ...l,
          productId: newProductId,
          variantId: variant?.id,
          unitPrice,
          lineTotal: l.quantity * unitPrice,
        };
      }),
    );
  };

  const handleVariantChange = (index: number, newVariantId: string) => {
    setLines(
      lines.map((l, idx) => {
        if (idx !== index) return l;
        const product = products.find((p) => p.id === l.productId);
        const actualVariantId = newVariantId === "none" ? undefined : newVariantId;
        const variant = product?.variants?.find((v) => v.id === actualVariantId);
        const base = product?.salesPrice ?? 0;
        const extra = variant?.extraPrice ?? variant?.priceDelta ?? 0;
        const unitPrice = base + extra;
        return {
          ...l,
          variantId: actualVariantId,
          unitPrice,
          lineTotal: l.quantity * unitPrice,
        };
      }),
    );
  };

  const handleQuantityChange = (index: number, qty: number) => {
    const quantity = Math.max(1, qty);
    setLines(
      lines.map((l, idx) => {
        if (idx !== index) return l;
        return {
          ...l,
          quantity,
          lineTotal: quantity * l.unitPrice,
        };
      }),
    );
  };

  const handleUnitPriceChange = (index: number, price: number) => {
    const unitPrice = Math.max(0, price);
    setLines(
      lines.map((l, idx) => {
        if (idx !== index) return l;
        return {
          ...l,
          unitPrice,
          lineTotal: l.quantity * unitPrice,
        };
      }),
    );
  };

  // Running Totals Calculation
  const subtotal = lines.reduce((acc, l) => acc + l.lineTotal, 0);
  const estimatedTax = Math.round(subtotal * 0.18); // 18% GST estimate
  const grandTotal = subtotal + estimatedTax;

  const handleSave = async () => {
    if (!isAdmin) {
      toast.error("Admin write access required to save quotation templates.");
      return;
    }
    if (!name.trim()) {
      toast.error("Template name is required.");
      return;
    }
    if (lines.length === 0) {
      toast.error("Add at least one order line to this template.");
      return;
    }

    try {
      setIsSaving(true);
      const formattedLines: QuotationTemplateLine[] = lines.map((l) => {
        const prod = products.find((p) => p.id === l.productId);
        const vari = prod?.variants?.find((v) => v.id === l.variantId);
        return {
          id: l.id,
          productId: l.productId,
          productName: prod?.name ?? "Product",
          variantId: l.variantId,
          variantName: vari ? `${vari.attribute}: ${vari.value}` : undefined,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineTotal: l.lineTotal,
          taxId: "tax_18",
        };
      });

      if (templateId) {
        await updateQuotationTemplate(templateId, {
          name: name.trim(),
          description: description.trim(),
          planId,
          planName: selectedPlan?.name ?? "Enterprise Plan",
          validityDays,
          lines: formattedLines,
          notes: notes.trim(),
        });
        toast.success("Quotation template updated successfully.");
      } else {
        const created = await createQuotationTemplate({
          name: name.trim(),
          description: description.trim(),
          planId,
          planName: selectedPlan?.name ?? "Enterprise Plan",
          validityDays,
          lines: formattedLines,
          notes: notes.trim(),
        });
        toast.success("Quotation template created successfully.");
        router.push(`/quotation-templates/${created.id}`);
      }

      queryClient.invalidateQueries({ queryKey: ["quotation-templates"] });
    } catch {
      toast.error("Failed to save quotation template.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUseTemplate = () => {
    const id = templateId ?? "qt_01";
    router.push(`/subscriptions/new?template=${id}`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/quotation-templates"
            className="h-8 w-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">
                {templateId
                  ? name || "Edit Quotation Template"
                  : "New Quotation Template"}
              </h1>
              <Badge variant="outline" className="text-[10px]">
                {isAdmin ? "Admin Editor" : "Staff View"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Define standard plan packages, auto-filled line items, and price guarantees.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Use Template Action */}
          {templateId && (
            <Button
              type="button"
              variant="outline"
              onClick={handleUseTemplate}
              className="gap-2 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
            >
              <Play className="h-3.5 w-3.5 fill-indigo-600 dark:fill-indigo-400" />
              Use this template
            </Button>
          )}

          {/* Save Button (Admin Only) */}
          {isAdmin ? (
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {templateId ? "Save Changes" : "Create Template"}
            </Button>
          ) : (
            <Badge variant="secondary" className="text-xs gap-1.5 py-1 px-2.5">
              Staff: Use Template Enabled
            </Badge>
          )}
        </div>
      </div>

      {/* Staff banner if viewing */}
      {!isAdmin && (
        <div className="flex items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50/70 dark:border-indigo-900/50 dark:bg-indigo-950/20 px-4 py-3 text-xs text-indigo-800 dark:text-indigo-300">
          <Sparkles className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
          <p>
            You are viewing this template in <strong>Staff</strong> mode. You can inspect the configured products, quantities and pricing, or click <strong>&quot;Use this template&quot;</strong> to start a client subscription.
          </p>
        </div>
      )}

      {/* Main Grid: Form Left, Summary Card Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form Details & Lines Table */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Template Basics */}
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-600" />
                Template Basics
              </CardTitle>
              <CardDescription className="text-xs">
                Package branding, target subscription plan and validity window.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Template Name */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="template-name" className="text-xs font-medium">
                    Template Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="template-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!isAdmin}
                    placeholder="e.g. Standard SaaS Growth Onboarding"
                    className="h-9 text-xs"
                  />
                </div>

                {/* Plan Selection */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    Target Plan <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={planId}
                    onValueChange={setPlanId}
                    disabled={!isAdmin}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select a plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          {p.name} ({formatCurrency(p.price)} / {p.billingPeriod})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Validity in days */}
                <div className="space-y-1.5">
                  <Label htmlFor="validity-days" className="text-xs font-medium">
                    Validity in Days <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="validity-days"
                      type="number"
                      min="1"
                      max="365"
                      value={validityDays}
                      onChange={(e) => setValidityDays(Number(e.target.value) || 30)}
                      disabled={!isAdmin}
                      className="h-9 text-xs pr-12"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-muted-foreground pointer-events-none">
                      days
                    </span>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="template-desc" className="text-xs font-medium">
                    Package Description
                  </Label>
                  <Input
                    id="template-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={!isAdmin}
                    placeholder="Brief description of what this quotation package delivers"
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Editable Lines Table */}
          <Card className="border-border/70 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Package className="h-4 w-4 text-indigo-600" />
                    Quotation Order Lines
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Configure products, dynamic variants, quantities and prefilled prices.
                  </CardDescription>
                </div>
                {isAdmin && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddLine}
                    className="h-8 text-xs gap-1.5 border-dashed"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Line
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="text-xs font-semibold w-[32%]">Product</TableHead>
                      <TableHead className="text-xs font-semibold w-[26%]">Variant</TableHead>
                      <TableHead className="text-xs font-semibold w-[14%]">Quantity</TableHead>
                      <TableHead className="text-xs font-semibold w-[14%]">Unit Price</TableHead>
                      <TableHead className="text-xs font-semibold w-[14%] text-right pr-4">
                        Line Total
                      </TableHead>
                      {isAdmin && <TableHead className="w-8"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line, index) => {
                      const selectedProduct = products.find((p) => p.id === line.productId);
                      const availableVariants = selectedProduct?.variants ?? [];

                      return (
                        <TableRow key={line.id} className="hover:bg-muted/20">
                          {/* Product select */}
                          <TableCell className="py-2.5">
                            <Select
                              value={line.productId}
                              onValueChange={(val) => handleProductChange(index, val)}
                              disabled={!isAdmin}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select product" />
                              </SelectTrigger>
                              <SelectContent>
                                {products.map((p) => (
                                  <SelectItem key={p.id} value={p.id} className="text-xs">
                                    {p.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>

                          {/* Variant select (Depends on selected Product) */}
                          <TableCell className="py-2.5">
                            <Select
                              value={line.variantId || "none"}
                              onValueChange={(val) => handleVariantChange(index, val)}
                              disabled={!isAdmin || availableVariants.length === 0}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="No variant" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none" className="text-xs">
                                  Default / Standard
                                </SelectItem>
                                {availableVariants.map((v) => (
                                  <SelectItem key={v.id} value={v.id} className="text-xs">
                                    {v.attribute}: {v.value} (+₹{v.extraPrice || v.priceDelta || 0})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>

                          {/* Quantity */}
                          <TableCell className="py-2.5">
                            <Input
                              type="number"
                              min="1"
                              value={line.quantity}
                              onChange={(e) =>
                                handleQuantityChange(index, Number(e.target.value))
                              }
                              disabled={!isAdmin}
                              className="h-8 text-xs font-mono w-20"
                            />
                          </TableCell>

                          {/* Unit price auto-filled & editable */}
                          <TableCell className="py-2.5">
                            <Input
                              type="number"
                              min="0"
                              value={line.unitPrice}
                              onChange={(e) =>
                                handleUnitPriceChange(index, Number(e.target.value))
                              }
                              disabled={!isAdmin}
                              className="h-8 text-xs font-mono w-24"
                            />
                          </TableCell>

                          {/* Line Total */}
                          <TableCell className="py-2.5 text-right font-mono font-semibold text-xs pr-4 text-foreground">
                            {formatCurrency(line.lineTotal)}
                          </TableCell>

                          {/* Delete line */}
                          {isAdmin && (
                            <TableCell className="py-2.5 pr-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveLine(index)}
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Running Total Bar */}
              <div className="bg-muted/30 p-4 border-t border-border/60 flex flex-col sm:flex-row justify-between items-end sm:items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  * Line prices include auto-filled variant adjustments.
                </span>
                <div className="w-full sm:w-72 space-y-1.5 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Lines Subtotal</span>
                    <span className="font-mono font-medium">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Estimated Tax (18% GST)</span>
                    <span className="font-mono">{formatCurrency(estimatedTax)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-foreground text-sm pt-1 border-t border-border/60">
                    <span>Running Total</span>
                    <span className="font-mono text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(grandTotal)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Notes & Terms */}
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Standard Quotation Terms</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={!isAdmin}
                rows={3}
                placeholder="Specify payment terms, onboarding prerequisites or service SLA guarantees..."
                className="text-xs"
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Summary Card */}
        <div className="space-y-6">
          <Card className="border-indigo-200 dark:border-indigo-900/60 shadow-md bg-gradient-to-br from-indigo-50/40 via-card to-background">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  Quotation Summary
                </CardTitle>
                <Badge className="bg-indigo-600 text-white text-[10px]">
                  {validityDays} Days Valid
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Real-time package metrics and quotation breakdown.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 pt-4">
              {/* Plan pill */}
              <div className="p-3 rounded-lg bg-card border border-border space-y-1">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">
                  Associated Billing Plan
                </span>
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-xs text-foreground">
                    {selectedPlan?.name || "Enterprise Monthly Growth"}
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    {selectedPlan?.billingPeriod || "monthly"}
                  </Badge>
                </div>
              </div>

              {/* Package Breakdown */}
              <div className="space-y-2 p-3 rounded-lg bg-card border border-border text-xs">
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Order Lines</span>
                  <span className="font-semibold text-foreground">{lines.length} items</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Total Units / Qty</span>
                  <span className="font-semibold text-foreground">
                    {lines.reduce((acc, l) => acc + l.quantity, 0)} units
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Validity Guarantee</span>
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    {validityDays} calendar days
                  </span>
                </div>
                <div className="flex justify-between py-1 font-bold text-sm text-foreground pt-2">
                  <span>Grand Total</span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400">
                    {formatCurrency(grandTotal)}
                  </span>
                </div>
              </div>

              {/* Action Call to Action */}
              <div className="pt-2 space-y-2">
                <Button
                  type="button"
                  onClick={handleUseTemplate}
                  className="w-full gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow"
                >
                  <Play className="h-4 w-4 fill-white" />
                  Use Template in Subscription
                </Button>
                <p className="text-[11px] text-muted-foreground text-center">
                  Staff and Admins can launch a client subscription prefilled with this exact bundle.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
