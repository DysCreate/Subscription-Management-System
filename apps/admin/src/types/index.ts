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

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  basePrice: number;
  isActive: boolean;
  createdAt: string;
  variants?: ProductVariant[];
}

/**
 * Example domain fact: a variant "Brand = Odoo" adds 560 to the price
 * (priceDelta = 560). basePrice + sum(priceDelta) of selected variants.
 */
export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  attributes: Record<string, string>;
  priceDelta: number;
}

export type BillingPeriod = "daily" | "weekly" | "monthly" | "yearly";

export interface Plan {
  id: string;
  productId: string;
  variantId?: string;
  name: string;
  description?: string;
  billingPeriod: BillingPeriod;
  price: number;
  trialDays?: number;
  isActive: boolean;
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/* Taxes & discounts                                                          */
/* -------------------------------------------------------------------------- */

export interface Tax {
  id: string;
  name: string;
  ratePercent: number;
  isInclusive: boolean;
}

export type DiscountType = "fixed" | "percent";

export interface Discount {
  id: string;
  code: string;
  type: DiscountType;
  /** Fixed amounts are in INR rupees; percent values are 0–100. */
  value: number;
  validFrom?: string;
  validTo?: string;
  maxUses?: number;
  usedCount?: number;
  isActive: boolean;
}

/* -------------------------------------------------------------------------- */
/* Quotation templates                                                        */
/* -------------------------------------------------------------------------- */

export interface QuotationTemplate {
  id: string;
  name: string;
  description?: string;
  productIds: string[];
  planIds: string[];
  taxIds: string[];
  discountIds?: string[];
  notes?: string;
  createdAt: string;
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
