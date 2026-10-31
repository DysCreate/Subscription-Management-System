/* =============================================================================
 * SubLoop domain types — mirror the NestJS backend entities 1:1.
 * Every module imports from here; never re-declare entity shapes ad-hoc.
 * ========================================================================== */

export type Role = "admin" | "staff" | "customer";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string;
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/* Customers                                                                  */
/* -------------------------------------------------------------------------- */

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  companyName?: string;
  gstNumber?: string;
  address?: string;
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/* Products, variants & plans                                                 */
/* -------------------------------------------------------------------------- */

export type ProductType = "Software" | "Add-on" | "Service" | "Hardware";

export interface Product {
  id: string;
  sku?: string;
  name: string;
  type: ProductType;
  description?: string;
  category?: string;
  salesPrice: number;
  costPrice: number;
  basePrice?: number;
  isActive: boolean;
  createdAt: string;
  variants: ProductVariant[];
}

/**
 * Example domain fact: a variant "Brand = Odoo" adds 560 to the price
 * (extraPrice / priceDelta = 560).
 */
export interface ProductVariant {
  id: string;
  productId?: string;
  name?: string;
  attribute: string;
  value: string;
  attributes?: Record<string, string>;
  extraPrice: number;
  priceDelta?: number;
}

export type BillingPeriod = "daily" | "weekly" | "monthly" | "yearly";

export type PlanStatus = "available" | "scheduled" | "expired";

export interface Plan {
  id: string;
  productId?: string;
  variantId?: string;
  name: string;
  description?: string;
  billingPeriod: BillingPeriod;
  price: number;
  minQuantity: number;
  availableFrom?: string;
  availableTo?: string;
  autoClose: boolean;
  closable: boolean;
  pausable: boolean;
  renewable: boolean;
  trialDays?: number;
  isActive: boolean;
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/* Taxes & discounts                                                          */
/* -------------------------------------------------------------------------- */

export type TaxType = "percent" | "fixed";
export type TaxStatus = "Active" | "Inactive";

export interface Tax {
  id: string;
  name: string;
  type?: TaxType;
  rate?: number;
  ratePercent: number;
  isInclusive: boolean;
  status?: TaxStatus;
  createdAt?: string;
  updatedAt?: string;
}

export type DiscountType = "fixed" | "percent";
export type DiscountScope = "Product" | "Subscription";
export type DiscountStatus = "Active" | "Scheduled" | "Expired" | "Exhausted";

export interface Discount {
  id: string;
  code: string;
  /** Friendly marketing name shown in summaries, e.g. "Annual prepay reward". */
  name?: string;
  type: DiscountType;
  /** Fixed amounts are in INR rupees; percent values are 0–100. */
  value: number;
  scope?: DiscountScope;
  productIds?: string[];
  minPurchaseAmount?: number;
  minQuantity?: number;
  validFrom?: string;
  validTo?: string;
  maxUses?: number;
  usedCount?: number;
  isActive: boolean;
  status?: DiscountStatus;
  /** When set, the discount only auto-applies to these plans. */
  planIds?: string[];
  /** Minimum pre-discount subtotal required for the discount to apply. */
  minSubtotal?: number;
  createdAt?: string;
  updatedAt?: string;
}

/* -------------------------------------------------------------------------- */
/* Quotation templates                                                        */
/* -------------------------------------------------------------------------- */

export interface QuotationTemplateLine {
  id: string;
  productId: string;
  productName?: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  taxId?: string;
}

export interface QuotationTemplate {
  id: string;
  name: string;
  description?: string;
  planId?: string;
  planName?: string;
  validityDays?: number;
  lines?: QuotationTemplateLine[];
  productIds: string[];
  planIds: string[];
  taxIds: string[];
  discountIds?: string[];
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

/* -------------------------------------------------------------------------- */
/* Subscriptions — Draft → Quotation → Confirmed → Active → Closed (+ paused) */
/* -------------------------------------------------------------------------- */

export type SubscriptionStatus =
  | "draft"
  | "quotation"
  | "confirmed"
  | "active"
  | "paused"
  | "closed";

export type PaymentTerms = "immediate" | "net_15" | "net_30" | "net_60";

export interface Subscription {
  id: string;
  subscriptionNumber: string;
  customerId: string;
  quotationTemplateId?: string;
  status: SubscriptionStatus;
  lines: SubscriptionLine[];
  startDate: string;
  endDate?: string;
  nextBillingDate?: string;
  closedAt?: string;
  createdAt: string;
  paymentTerms?: PaymentTerms;
  discountId?: string;
  subtotal?: number;
  discountTotal?: number;
  taxTotal?: number;
  total?: number;
}

export interface SubscriptionLine {
  id: string;
  subscriptionId: string;
  productId: string;
  variantId?: string;
  planId: string;
  quantity: number;
  unitPrice: number;
  discountType?: DiscountType;
  discountValue: number;
  taxRatePercent: number;
}

/* -------------------------------------------------------------------------- */
/* Invoices — Draft → Confirmed → Paid (+ Cancelled); "Overdue" is derived     */
/* -------------------------------------------------------------------------- */

export type InvoiceStatus = "draft" | "confirmed" | "paid" | "cancelled";

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  subscriptionId: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  paidAt?: string;
  lines: InvoiceLine[];
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
}

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRatePercent: number;
  discountValue: number;
  lineTotal: number;
}

export function isInvoiceOverdue(
  invoice: Pick<Invoice, "status" | "dueDate" | "paidAt">,
  now: Date = new Date(),
): boolean {
  return (
    invoice.status === "confirmed" &&
    !invoice.paidAt &&
    new Date(invoice.dueDate).getTime() < now.getTime()
  );
}

/* -------------------------------------------------------------------------- */
/* Payments — card, bank transfer, UPI, cash, cheque                          */
/* -------------------------------------------------------------------------- */

export type PaymentMethod = "card" | "bank_transfer" | "upi" | "cash" | "cheque";

export interface Payment {
  id: string;
  paymentReference: string;
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
  notes?: string;
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/* API list envelope + query params shared by every list endpoint              */
/* -------------------------------------------------------------------------- */

export interface ListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filters?: Record<string, string>;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
