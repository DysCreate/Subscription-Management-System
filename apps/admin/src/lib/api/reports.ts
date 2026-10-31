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

export async function getReportSummary(params?: { from?: string; to?: string }): Promise<ReportSummary> {
  const query = new URLSearchParams();
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  const path = query.toString() ? `/reports/summary?${query.toString()}` : "/reports/summary";
  return apiRequest<ReportSummary>(path, { mock: () => ({}) as any });
}

export async function getRevenueByMonth() {
  return apiRequest<any[]>("/reports/revenue-by-month", { mock: () => [] });
}

export async function getPaymentsByMethod() {
  return apiRequest<any[]>("/reports/payments-by-method", { mock: () => [] });
}

export async function getSubscriptionsByStatus() {
  return apiRequest<any[]>("/reports/subscriptions-by-status", { mock: () => [] });
}

export async function getNewVsChurned() {
  return apiRequest<any[]>("/reports/new-vs-churned", { mock: () => [] });
}

export async function getOverdueReport(params?: { page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  const path = query.toString() ? `/reports/overdue?${query.toString()}` : "/reports/overdue";
  return apiRequest<any>(path, { mock: () => ({ items: [], total: 0 }) });
}

export async function getRenewalsUpcoming() {
  return apiRequest<any[]>("/reports/renewals-upcoming", { mock: () => [] });
}

export async function exportReportsCsv(params?: { from?: string; to?: string }) {
  const query = new URLSearchParams();
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  const path = query.toString() ? `/reports/export.csv?${query.toString()}` : "/reports/export.csv";
  if ((await import("./client")).USE_MOCK) {
    return "metric,value\n";
  }
  const res = await fetch(`${(await import("./client")).API_URL}${path.startsWith("/") ? path : `/${path}`}`, {
    headers: (() => {
      try {
        const token = localStorage.getItem("subloop_access_token") || localStorage.getItem("accessToken");
        return token ? { Authorization: `Bearer ${token}` } : {};
      } catch {
        return {};
      }
    })(),
  });
  return res.text();
}
