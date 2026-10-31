"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Tax, TaxStatus, TaxType } from "@/types";

const taxSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  type: z.enum(["percent", "fixed"]),
  rate: z.coerce
    .number({ invalid_type_error: "Enter a valid numeric rate" })
    .min(0, "Rate cannot be negative"),
  status: z.enum(["Active", "Inactive"]),
}).superRefine((data, ctx) => {
  if (data.type === "percent" && data.rate > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Percentage tax rate cannot exceed 100%",
      path: ["rate"],
    });
  }
});

type TaxFormValues = z.infer<typeof taxSchema>;

interface TaxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tax: Tax | null;
  onSave: (values: {
    name: string;
    type: TaxType;
    rate: number;
    status: TaxStatus;
  }) => Promise<void>;
}

export function TaxDialog({ open, onOpenChange, tax, onSave }: TaxDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<TaxFormValues>({
    resolver: zodResolver(taxSchema),
    defaultValues: {
      name: "",
      type: "percent",
      rate: 18,
      status: "Active",
    },
  });

  const selectedType = watch("type");
  const selectedStatus = watch("status");

  React.useEffect(() => {
    if (tax) {
      reset({
        name: tax.name,
        type: tax.type ?? "percent",
        rate: tax.rate ?? tax.ratePercent ?? 0,
        status: tax.status ?? "Active",
      });
    } else {
      reset({
        name: "",
        type: "percent",
        rate: 18,
        status: "Active",
      });
    }
  }, [tax, reset, open]);

  const onSubmit = async (values: TaxFormValues) => {
    try {
      setIsSubmitting(true);
      await onSave({
        name: values.name,
        type: values.type,
        rate: values.rate,
        status: values.status,
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {tax ? "Edit Tax Rule" : "Add Tax Rule"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure rates applied to invoice line items and recurring subscriptions.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="tax-name" className="text-xs font-medium">
              Tax Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="tax-name"
              placeholder="e.g. GST 18% or Environmental Surcharge"
              className="h-9 text-xs"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-[11px] text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Type */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tax Calculation Type</Label>
              <Select
                value={selectedType}
                onValueChange={(val) => setValue("type", val as TaxType)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent" className="text-xs">
                    Percentage (%)
                  </SelectItem>
                  <SelectItem value="fixed" className="text-xs">
                    Fixed Amount (₹)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Rate */}
            <div className="space-y-1.5">
              <Label htmlFor="tax-rate" className="text-xs font-medium">
                {selectedType === "percent" ? "Rate (%)" : "Amount (₹)"}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="tax-rate"
                  type="number"
                  step={selectedType === "percent" ? "0.1" : "1"}
                  placeholder={selectedType === "percent" ? "18" : "150"}
                  className="h-9 text-xs pr-7"
                  {...register("rate")}
                />
                <span className="absolute right-2.5 top-2.5 text-xs text-muted-foreground pointer-events-none">
                  {selectedType === "percent" ? "%" : "₹"}
                </span>
              </div>
              {errors.rate && (
                <p className="text-[11px] text-destructive">{errors.rate.message}</p>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Status</Label>
            <Select
              value={selectedStatus}
              onValueChange={(val) => setValue("status", val as TaxStatus)}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active" className="text-xs">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Active
                  </span>
                </SelectItem>
                <SelectItem value="Inactive" className="text-xs">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                    Inactive
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {tax ? "Save Changes" : "Create Tax Rule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
