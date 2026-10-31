export type SubscriptionStatus = "Active" | "Paused" | "Pending";
export type InvoiceStatus = "Paid" | "Outstanding" | "Overdue";

export interface Subscription {
  id: string;
  plan: string;
  amount: number;
  period: "month" | "year";
  status: SubscriptionStatus;
  nextBillingDate: string;
}

export interface PortalInvoice {
  id: string;
  issuedAt: string;
  dueDate: string;
  amount: number;
  status: InvoiceStatus;
  description: string;
}

export interface DashboardSummary {
  activeSubscriptions: number;
  monthlyRevenue: number;
  outstanding: number;
  unpaidInvoiceCount: number;
  overdueCount: number;
  upcomingRenewalCount: number;
  paymentsByMethod: Array<{ method: string; amount: number }>;
}

export interface RevenueMonth {
  month: string;
  amount: number;
}

export type ReportInvoiceStatus = "Paid" | "Outstanding" | "Overdue";

export interface ReportInvoice {
  invoiceNumber: string;
  customer: string;
  plan: string;
  dueDate: string;
  amount: number;
  status: ReportInvoiceStatus;
}

export interface InvoiceFilters {
  status: "All statuses" | ReportInvoiceStatus;
  customer: string;
  plan: string;
  dueFrom: string;
  dueTo: string;
  page: number;
  pageSize: number;
}

export interface InvoicePage {
  items: ReportInvoice[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  revenue: RevenueMonth[];
}
