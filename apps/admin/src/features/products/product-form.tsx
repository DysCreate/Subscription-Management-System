"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  ArrowLeft,
  Check,
  Edit2,
  Info,
  Layers,
  Loader2,
  Package,
  Plus,
  Save,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/format";
import {
  calculateMargin,
  createProduct,
  updateProduct,
} from "@/lib/api/products";
import type { Product, ProductType, ProductVariant } from "@/types";
import { cn } from "@/lib/utils";

const productFormSchema = z.object({
  name: z.string().min(2, "Product name must be at least 2 characters"),
  type: z.enum(["Software", "Add-on", "Service", "Hardware"]),
  salesPrice: z.coerce.number().min(0, "Sales price cannot be negative"),
  costPrice: z.coerce.number().min(0, "Cost price cannot be negative"),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

type ProductFormData = z.infer<typeof productFormSchema>;

export interface ProductFormProps {
  initialProduct?: Product;
}

export function ProductForm({ initialProduct }: ProductFormProps) {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Variants state (Attribute, Value, Extra price)
  const [variants, setVariants] = React.useState<ProductVariant[]>(
    initialProduct?.variants || [],
  );

  // Inline add variant form state
  const [newAttribute, setNewAttribute] = React.useState("");
  const [newValue, setNewValue] = React.useState("");
  const [newExtraPrice, setNewExtraPrice] = React.useState<string>("0");

  // Inline edit state
  const [editingVariantId, setEditingVariantId] = React.useState<string | null>(
    null,
  );
  const [editAttribute, setEditAttribute] = React.useState("");
  const [editValue, setEditValue] = React.useState("");
  const [editExtraPrice, setEditExtraPrice] = React.useState<string>("0");

  const isEditing = Boolean(initialProduct);

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: initialProduct?.name || "",
      type: initialProduct?.type || "Software",
      salesPrice: initialProduct?.salesPrice ?? 0,
      costPrice: initialProduct?.costPrice ?? 0,
      description: initialProduct?.description || "",
      isActive: initialProduct?.isActive ?? true,
    },
    mode: "onChange",
  });

  const salesPrice = form.watch("salesPrice") || 0;
  const costPrice = form.watch("costPrice") || 0;
  const marginInfo = calculateMargin(Number(salesPrice), Number(costPrice));

  const handleAddVariant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAttribute.trim() || !newValue.trim()) {
      toast.error("Please enter both attribute and value");
      return;
    }

    const extra = Number(newExtraPrice) || 0;
    const newVariant: ProductVariant = {
      id: `var_${Date.now()}`,
      productId: initialProduct?.id,
      attribute: newAttribute.trim(),
      value: newValue.trim(),
      extraPrice: extra,
      priceDelta: extra,
    };

    setVariants((prev) => [...prev, newVariant]);
    setNewAttribute("");
    setNewValue("");
    setNewExtraPrice("0");
    toast.success("Variant added");
  };

  const handleStartEditVariant = (variant: ProductVariant) => {
    setEditingVariantId(variant.id);
    setEditAttribute(variant.attribute);
    setEditValue(variant.value);
    setEditExtraPrice(String(variant.extraPrice));
  };

  const handleSaveEditVariant = (id: string) => {
    if (!editAttribute.trim() || !editValue.trim()) {
      toast.error("Attribute and value cannot be empty");
      return;
    }
    const extra = Number(editExtraPrice) || 0;
    setVariants((prev) =>
      prev.map((v) =>
        v.id === id
          ? {
              ...v,
              attribute: editAttribute.trim(),
              value: editValue.trim(),
              extraPrice: extra,
              priceDelta: extra,
            }
          : v,
      ),
    );
    setEditingVariantId(null);
    toast.success("Variant updated");
  };

  const handleDeleteVariant = (id: string) => {
    setVariants((prev) => prev.filter((v) => v.id !== id));
    toast.success("Variant removed");
  };

  const onSubmit = async (data: ProductFormData) => {
    if (!isAdmin) {
      toast.error("Staff members have read-only access");
      return;
    }

    try {
      setIsSubmitting(true);
      if (isEditing && initialProduct) {
        await updateProduct(initialProduct.id, {
          name: data.name,
          type: data.type,
          salesPrice: data.salesPrice,
          costPrice: data.costPrice,
          description: data.description,
          isActive: data.isActive,
          variants,
        });
        toast.success("Product updated successfully");
      } else {
        await createProduct({
          name: data.name,
          type: data.type,
          salesPrice: data.salesPrice,
          costPrice: data.costPrice,
          description: data.description,
          isActive: data.isActive,
          variants,
        });
        toast.success("Product created successfully");
      }
      router.push("/products");
    } catch {
      toast.error("Failed to save product");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top back navigation & title */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="icon" className="h-9 w-9">
            <Link href="/products" aria-label="Back to products list">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isEditing ? `Edit ${initialProduct?.name}` : "Create New Product"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEditing
                ? "Update catalog item attributes, base pricing, and variant modifiers."
                : "Add a sellable software, service, hardware, or add-on product."}
            </p>
          </div>
        </div>

        {/* Read-only badge if staff */}
        {!isAdmin && (
          <Badge variant="outline" className="gap-1.5 py-1 text-xs">
            <Info className="h-3.5 w-3.5 text-amber-500" />
            Staff Mode: Read-Only
          </Badge>
        )}
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Two-Column Form Layout: Left Inputs, Right Live Margin Preview */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column: Core Fields (2 cols wide) */}
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5 text-indigo-600" />
                Product Details
              </CardTitle>
              <CardDescription>
                Define primary categorization and financial baseline
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Product Name */}
              <div className="space-y-1.5">
                <Label htmlFor="name">Product Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g. Odoo ERP Enterprise"
                  disabled={!isAdmin || isSubmitting}
                  {...form.register("name")}
                />
                {form.formState.errors.name && (
                  <p className="text-xs font-medium text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              {/* Product Type & Active Switch in 2 columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="type">Product Type *</Label>
                  <Select
                    defaultValue={form.getValues("type")}
                    onValueChange={(val: ProductType) =>
                      form.setValue("type", val)
                    }
                    disabled={!isAdmin || isSubmitting}
                  >
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Software">Software</SelectItem>
                      <SelectItem value="Add-on">Add-on</SelectItem>
                      <SelectItem value="Service">Service</SelectItem>
                      <SelectItem value="Hardware">Hardware</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Active switch */}
                <div className="flex flex-col justify-end">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label htmlFor="isActive" className="text-sm">
                        Product Status
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {form.watch("isActive") ? "Active in catalog" : "Inactive / Archived"}
                      </p>
                    </div>
                    <Switch
                      id="isActive"
                      checked={form.watch("isActive")}
                      onCheckedChange={(val) => form.setValue("isActive", val)}
                      disabled={!isAdmin || isSubmitting}
                    />
                  </div>
                </div>
              </div>

              {/* Pricing: Sales price and Cost price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="salesPrice">Sales Price (INR) *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-sm text-muted-foreground font-semibold">
                      ₹
                    </span>
                    <Input
                      id="salesPrice"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="pl-7"
                      disabled={!isAdmin || isSubmitting}
                      {...form.register("salesPrice")}
                    />
                  </div>
                  {form.formState.errors.salesPrice && (
                    <p className="text-xs font-medium text-destructive">
                      {form.formState.errors.salesPrice.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="costPrice">Cost Price (INR) *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-sm text-muted-foreground font-semibold">
                      ₹
                    </span>
                    <Input
                      id="costPrice"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="pl-7"
                      disabled={!isAdmin || isSubmitting}
                      {...form.register("costPrice")}
                    />
                  </div>
                  {form.formState.errors.costPrice && (
                    <p className="text-xs font-medium text-destructive">
                      {form.formState.errors.costPrice.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Notes / Description */}
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="description">Notes & Scope Description</Label>
                <Textarea
                  id="description"
                  placeholder="Outline feature inclusions, deployment prerequisites, or billing cycle details..."
                  rows={3}
                  disabled={!isAdmin || isSubmitting}
                  {...form.register("description")}
                />
              </div>
            </CardContent>
          </Card>

          {/* Right Column: Live Margin Preview Card */}
          <Card className="shadow-sm border-indigo-100 dark:border-indigo-950/60 bg-gradient-to-b from-card to-muted/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Live Margin Preview</span>
                {marginInfo.tier === "high" ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 text-[11px]">
                    <TrendingUp className="h-3 w-3" />
                    High Margin
                  </Badge>
                ) : marginInfo.tier === "moderate" ? (
                  <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1 text-[11px]">
                    <TrendingUp className="h-3 w-3" />
                    Moderate
                  </Badge>
                ) : (
                  <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 gap-1 text-[11px]">
                    <TrendingDown className="h-3 w-3" />
                    Low / Negative
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Calculated automatically from sales and cost inputs
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Primary Margin % Metric Display */}
              <div
                className={cn(
                  "flex flex-col items-center justify-center p-5 rounded-2xl border text-center transition-all",
                  marginInfo.tier === "high"
                    ? "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/50"
                    : marginInfo.tier === "moderate"
                      ? "bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50"
                      : "bg-rose-50/50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/50",
                )}
              >
                <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                  Profit Margin
                </span>
                <span
                  className={cn(
                    "text-4xl font-extrabold tracking-tight mt-1 font-mono",
                    marginInfo.tier === "high"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : marginInfo.tier === "moderate"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-rose-600 dark:text-rose-400",
                  )}
                >
                  {marginInfo.marginPercent}%
                </span>
                <span className="text-xs text-muted-foreground mt-1">
                  Net Profit:{" "}
                  <strong className="text-foreground">
                    {formatCurrency(marginInfo.marginAmount)}
                  </strong>{" "}
                  per unit
                </span>
              </div>

              {/* Breakdown Rows */}
              <div className="space-y-2 text-xs divide-y divide-border/60">
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Selling Price:</span>
                  <span className="font-semibold text-foreground font-mono">
                    {formatCurrency(Number(salesPrice))}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Estimated Cost:</span>
                  <span className="font-semibold text-foreground font-mono">
                    {formatCurrency(Number(costPrice))}
                  </span>
                </div>
                <div className="flex justify-between py-1 font-medium">
                  <span className="text-muted-foreground">Gross Profit:</span>
                  <span
                    className={cn(
                      "font-bold font-mono",
                      marginInfo.marginAmount >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600",
                    )}
                  >
                    {formatCurrency(marginInfo.marginAmount)}
                  </span>
                </div>
              </div>

              {/* Progress Bar visualization */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Margin Ratio</span>
                  <span>{Math.max(0, Math.min(100, marginInfo.marginPercent))}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full transition-all duration-300",
                      marginInfo.tier === "high"
                        ? "bg-emerald-500"
                        : marginInfo.tier === "moderate"
                          ? "bg-amber-500"
                          : "bg-rose-500",
                    )}
                    style={{
                      width: `${Math.max(0, Math.min(100, marginInfo.marginPercent))}%`,
                    }}
                  />
                </div>
              </div>

              <div className="rounded-lg bg-muted/50 p-2.5 text-[11px] text-muted-foreground leading-relaxed">
                <strong>Benchmark Guide:</strong> Software solutions aim for &gt;
                30% margins. Hardware typically operates at 10–25%.
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Variants Table on the Same Page */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-600" />
                Product Variants
              </CardTitle>
              <CardDescription>
                Configure attribute modifiers with dynamic extra pricing (e.g. Brand = Odoo adds ₹560)
              </CardDescription>
            </div>
            <Badge variant="secondary" className="w-fit text-xs font-mono">
              {variants.length} {variants.length === 1 ? "variant" : "variants"}
            </Badge>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Inline Add Variant Row (Admin only) */}
            {isAdmin && (
              <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/30 p-3.5 dark:border-indigo-950 dark:bg-indigo-950/20">
                <div className="mb-2 text-xs font-semibold text-indigo-900 dark:text-indigo-200">
                  Add New Variant Modifier
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
                  <div className="space-y-1">
                    <Label htmlFor="var-attr" className="text-xs">
                      Attribute (e.g. Brand)
                    </Label>
                    <Input
                      id="var-attr"
                      placeholder="e.g. Brand"
                      value={newAttribute}
                      onChange={(e) => setNewAttribute(e.target.value)}
                      className="h-8 text-xs bg-background"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="var-val" className="text-xs">
                      Value (e.g. Odoo)
                    </Label>
                    <Input
                      id="var-val"
                      placeholder="e.g. Odoo"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      className="h-8 text-xs bg-background"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="var-extra" className="text-xs">
                      Extra Price (INR)
                    </Label>
                    <Input
                      id="var-extra"
                      type="number"
                      step="any"
                      placeholder="560"
                      value={newExtraPrice}
                      onChange={(e) => setNewExtraPrice(e.target.value)}
                      className="h-8 text-xs bg-background"
                    />
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddVariant}
                    className="h-8 gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Variant
                  </Button>
                </div>
              </div>
            )}

            {/* Variants Data Table */}
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[200px]">Attribute</TableHead>
                    <TableHead className="w-[200px]">Value</TableHead>
                    <TableHead>Extra Price</TableHead>
                    <TableHead>Combined Price Preview</TableHead>
                    {isAdmin && (
                      <TableHead className="w-[100px] text-right">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variants.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={isAdmin ? 5 : 4}
                        className="h-20 text-center text-xs text-muted-foreground"
                      >
                        No product variants configured yet. Base pricing applies to all orders.
                      </TableCell>
                    </TableRow>
                  ) : (
                    variants.map((v) => {
                      const isEditingThis = editingVariantId === v.id;
                      const combined = Number(salesPrice || 0) + Number(v.extraPrice || 0);

                      if (isEditingThis) {
                        return (
                          <TableRow key={v.id} className="bg-muted/20">
                            <TableCell>
                              <Input
                                value={editAttribute}
                                onChange={(e) => setEditAttribute(e.target.value)}
                                className="h-7 text-xs"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="h-7 text-xs"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="any"
                                value={editExtraPrice}
                                onChange={(e) => setEditExtraPrice(e.target.value)}
                                className="h-7 text-xs"
                              />
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {formatCurrency(Number(salesPrice) + Number(editExtraPrice))}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-emerald-600 hover:bg-emerald-50"
                                  onClick={() => handleSaveEditVariant(v.id)}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-muted-foreground"
                                  onClick={() => setEditingVariantId(null)}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      }

                      return (
                        <TableRow key={v.id} className="hover:bg-muted/30">
                          <TableCell className="font-medium text-xs">
                            {v.attribute}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-normal text-xs">
                              {v.value}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {v.extraPrice > 0
                              ? `+ ${formatCurrency(v.extraPrice)}`
                              : "Included (₹0)"}
                          </TableCell>
                          <TableCell className="font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                            {formatCurrency(combined)}
                            <span className="text-[10px] text-muted-foreground font-normal ml-1">
                              ({formatCurrency(Number(salesPrice))} + {formatCurrency(v.extraPrice)})
                            </span>
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                  onClick={() => handleStartEditVariant(v)}
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                  onClick={() => handleDeleteVariant(v.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons Footer */}
        {isAdmin && (
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button asChild variant="outline" type="button" disabled={isSubmitting}>
              <Link href="/products">Cancel</Link>
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving Product...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {isEditing ? "Update Product" : "Create Product"}
                </>
              )}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
