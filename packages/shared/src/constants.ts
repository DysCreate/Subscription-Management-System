/** API surface version prefix (architecture.md §10). */
export const API_PREFIX = 'api/v1';

export const ROLES = ['ADMIN', 'STAFF', 'CUSTOMER'] as const;
export type Role = (typeof ROLES)[number];

export const BILLING_PERIODS = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number];

export const SUBSCRIPTION_STATUSES = [
  'DRAFT',
  'QUOTATION',
  'CONFIRMED',
  'ACTIVE',
  'PAUSED',
  'CLOSED',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const INVOICE_STATUSES = ['DRAFT', 'CONFIRMED', 'PAID', 'CANCELLED'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const TAX_TYPES = ['PERCENT', 'FIXED'] as const;
export type TaxType = (typeof TAX_TYPES)[number];

export const DISCOUNT_TYPES = ['FIXED', 'PERCENT'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export const DISCOUNT_SCOPES = ['PRODUCT', 'SUBSCRIPTION'] as const;
export type DiscountScope = (typeof DISCOUNT_SCOPES)[number];

export const PAYMENT_METHODS = ['CARD', 'BANK', 'UPI', 'CASH', 'CHEQUE'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Password must be *more than* 8 characters, with upper, lower and a special char. */
export const PASSWORD_MIN_LENGTH = 9;

export const DEFAULT_QUOTATION_VALIDITY_DAYS = 30;
export const DEFAULT_PASSWORD_RESET_TTL_MINUTES = 30;

export const SUBSCRIPTION_NUMBER_PREFIX = 'SUB-';
export const INVOICE_NUMBER_PREFIX = 'INV-';

/** Days a new subscription runs for, per plan billing period. */
export const BILLING_PERIOD_DAYS: Record<BillingPeriod, number> = {
  DAILY: 1,
  WEEKLY: 7,
  MONTHLY: 30,
  YEARLY: 365,
};

/** Modules a role is allowed to reach. Route-level @Roles() guards use these. */
export const STAFF_WRITE_DENYLIST = ['discounts', 'users/staff'] as const;
