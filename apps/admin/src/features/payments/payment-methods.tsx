"use client";

import * as React from "react";
import {
  Banknote,
  CreditCard,
  Landmark,
  ScrollText,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import type { PaymentMethod } from "@/types";
import { cn } from "@/lib/utils";

export interface PaymentMethodOption {
  value: PaymentMethod;
  label: string;
  icon: LucideIcon;
  hint: string;
}

export const PAYMENT_METHOD_OPTIONS: PaymentMethodOption[] = [
  { value: "card", label: "Card", icon: CreditCard, hint: "Credit / debit" },
  {
    value: "bank_transfer",
    label: "Bank transfer",
    icon: Landmark,
    hint: "NEFT / RTGS",
  },
  { value: "upi", label: "UPI", icon: Smartphone, hint: "UPI / QR" },
  { value: "cash", label: "Cash", icon: Banknote, hint: "In person" },
  { value: "cheque", label: "Cheque", icon: ScrollText, hint: "Cheque / DD" },
];

const METHOD_MAP = new Map<PaymentMethod, PaymentMethodOption>(
  PAYMENT_METHOD_OPTIONS.map((option) => [option.value, option]),
);

export function paymentMethodLabel(method: PaymentMethod): string {
  return METHOD_MAP.get(method)?.label ?? method;
}

export function PaymentMethodBadge({
  method,
  className,
}: {
  method: PaymentMethod;
  className?: string;
}) {
  const option = METHOD_MAP.get(method);
  const Icon = option?.icon ?? CreditCard;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm text-foreground",
        className,
      )}
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
      </span>
      {option?.label ?? method}
    </span>
  );
}
