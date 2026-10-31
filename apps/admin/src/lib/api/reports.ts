import { apiRequest } from "./client";

export interface ReportSummary {
  activeSubscriptions: number;
  mrr: number;
  arr: number;
  revenueCollected: number;
  outstanding: number;
  overdueCount: number;
  overdueAmount: number;
  delta: Record<string, number>;
}

const MOCK_SUMMARY: ReportSummary = {
  activeSubscriptions: 24,
  mrr: 185000,
  arr: 2220000,
  revenueCollected: 540000,
  outstanding: 68500,
  overdueCount: 3,
  overdueAmount: 32000,
  delta: {
    activeSubscriptions: 12.5,
    mrr: 8.3,
    arr: 8.3,
    revenueCollected: 14.2,
    outstanding: -5.1,
    overdueCount: -25.0,
  },
};

const MOCK_REVENUE_BY_MONTH = [
  { month: "May 2026", revenue: 125000 },
  { month: "Jun 2026", revenue: 142000 },
  { month: "Jul 2026", revenue: 158000 },
  { month: "Aug 2026", revenue: 165000 },
  { month: "Sep 2026", revenue: 178000 },
  { month: "Oct 2026", revenue: 185000 },
];

const MOCK_SUBSCRIPTIONS_BY_STATUS = [
  { status: "ACTIVE", count: 24 },
  { status: "DRAFT", count: 5 },
  { status: "PAUSED", count: 3 },
  { status: "CANCELLED", count: 2 },
  { status: "CLOSED", count: 1 },
];

const MOCK_PAYMENTS_BY_METHOD = [
  { method: "UPI", amount: 245000, count: 68 },
  { method: "Card", amount: 168000, count: 34 },
  { method: "Bank Transfer", amount: 82000, count: 12 },
  { method: "Razorpay", amount: 45000, count: 18 },
];

const MOCK_NEW_VS_CHURNED = [
  { month: "May 2026", new: 8, churned: 1 },
  { month: "Jun 2026", new: 10, churned: 2 },
  { month: "Jul 2026", new: 9, churned: 1 },
  { month: "Aug 2026", new: 12, churned: 3 },
  { month: "Sep 2026", new: 14, churned: 2 },
  { month: "Oct 2026", new: 15, churned: 1 },
];

const MOCK_OVERDUE_REPORT = {
  items: [
    {
      id: "inv-overdue-1",
      invoiceNumber: "INV-2026-0084",
      customer: "Acme Technologies Pvt Ltd",
      daysLate: 18,
      balance: 14500,
    },
    {
      id: "inv-overdue-2",
      invoiceNumber: "INV-2026-0091",
      customer: "Global Infotech Solutions",
      daysLate: 12,
      balance: 9800,
    },
    {
      id: "inv-overdue-3",
      invoiceNumber: "INV-2026-0097",
      customer: "Zion Creative Studios",
      daysLate: 5,
      balance: 7700,
    },
  ],
  total: 3,
};

const MOCK_RENEWALS_UPCOMING = [
  {
    id: "sub-ren-1",
    subscriptionNumber: "SUB-2026-0018",
    customer: "Horizon Media Labs",
    nextBillingDate: new Date(Date.now() + 3 * 86400000).toISOString(),
  },
  {
    id: "sub-ren-2",
    subscriptionNumber: "SUB-2026-0022",
    customer: "Nexus Digital Works",
    nextBillingDate: new Date(Date.now() + 7 * 86400000).toISOString(),
  },
  {
    id: "sub-ren-3",
    subscriptionNumber: "SUB-2026-0029",
    customer: "Apex Logistics Corp",
    nextBillingDate: new Date(Date.now() + 14 * 86400000).toISOString(),
  },
  {
    id: "sub-ren-4",
    subscriptionNumber: "SUB-2026-0035",
    customer: "Kite Finserve Ltd",
    nextBillingDate: new Date(Date.now() + 21 * 86400000).toISOString(),
  },
];

export async function getReportSummary(params?: { from?: string; to?: string }): Promise<ReportSummary> {
  const query = new URLSearchParams();
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  const path = query.toString() ? `/reports/summary?${query.toString()}` : "/reports/summary";
  return apiRequest<ReportSummary>(path, { mock: () => MOCK_SUMMARY });
}

export async function getRevenueByMonth() {
  return apiRequest<any[]>("/reports/revenue-by-month", { mock: () => MOCK_REVENUE_BY_MONTH });
}

export async function getPaymentsByMethod() {
  return apiRequest<any[]>("/reports/payments-by-method", { mock: () => MOCK_PAYMENTS_BY_METHOD });
}

export async function getSubscriptionsByStatus() {
  return apiRequest<any[]>("/reports/subscriptions-by-status", { mock: () => MOCK_SUBSCRIPTIONS_BY_STATUS });
}

export async function getNewVsChurned() {
  return apiRequest<any[]>("/reports/new-vs-churned", { mock: () => MOCK_NEW_VS_CHURNED });
}

export async function getOverdueReport(params?: { page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  const path = query.toString() ? `/reports/overdue?${query.toString()}` : "/reports/overdue";
  return apiRequest<any>(path, { mock: () => MOCK_OVERDUE_REPORT });
}

export async function getRenewalsUpcoming() {
  return apiRequest<any[]>("/reports/renewals-upcoming", { mock: () => MOCK_RENEWALS_UPCOMING });
}

export async function exportReportsCsv(params?: { from?: string; to?: string }) {
  const query = new URLSearchParams();
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  const path = query.toString() ? `/reports/export.csv?${query.toString()}` : "/reports/export.csv";
  if ((await import("./client")).USE_MOCK) {
    return "metric,value\nactiveSubscriptions,24\nmrr,185000\narr,2220000\nrevenueCollected,540000\noutstanding,68500\n";
  }
  const headers: Record<string, string> = {};
  try {
    const token = localStorage.getItem("subloop_access_token") || localStorage.getItem("accessToken");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  } catch {
    // ignore
  }
  const res = await fetch(`${(await import("./client")).API_URL}${path.startsWith("/") ? path : `/${path}`}`, {
    headers,
  });
  return res.text();
}
