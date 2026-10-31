import type { PaymentTerms, SubscriptionStatus } from "@/types";
import type { SubscriptionTabStatus } from "@/lib/api/subscriptions";

export const SUBSCRIPTION_TABS: {
  value: SubscriptionTabStatus;
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "quotation", label: "Quotation" },
  { value: "confirmed", label: "Confirmed" },
  { value: "active", label: "Active" },
  { value: "closed", label: "Closed" },
];

export const PAYMENT_TERMS_OPTIONS: {
  value: PaymentTerms;
  label: string;
  description: string;
}[] = [
  {
    value: "immediate",
    label: "Immediate",
    description: "Payment is due as soon as the invoice is issued.",
  },
  {
    value: "net_15",
    label: "Net 15",
    description: "Payment is due within 15 days of the invoice date.",
  },
  {
    value: "net_30",
    label: "Net 30",
    description: "Payment is due within 30 days of the invoice date.",
  },
  {
    value: "net_60",
    label: "Net 60",
    description: "Payment is due within 60 days of the invoice date.",
  },
];

export function getPaymentTermsLabel(terms?: PaymentTerms): string {
  return (
    PAYMENT_TERMS_OPTIONS.find((option) => option.value === terms)?.label ??
    "Net 30"
  );
}

export interface StatusAction {
  label: string;
  status: SubscriptionStatus;
  tone?: "primary" | "danger";
}

/** Lifecycle actions available from the row / detail action menu. */
export function getStatusActions(status: SubscriptionStatus): StatusAction[] {
  switch (status) {
    case "draft":
      return [{ label: "Send quotation", status: "quotation", tone: "primary" }];
    case "quotation":
      return [
        { label: "Confirm order", status: "confirmed", tone: "primary" },
        { label: "Mark as lost", status: "closed", tone: "danger" },
      ];
    case "confirmed":
      return [
        { label: "Activate subscription", status: "active", tone: "primary" },
        { label: "Cancel subscription", status: "closed", tone: "danger" },
      ];
    case "active":
      return [
        { label: "Pause billing", status: "paused" },
        { label: "Close subscription", status: "closed", tone: "danger" },
      ];
    case "paused":
      return [
        { label: "Resume subscription", status: "active", tone: "primary" },
        { label: "Close subscription", status: "closed", tone: "danger" },
      ];
    case "closed":
      return [];
  }
}
