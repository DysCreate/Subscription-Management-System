import type {
  DashboardData,
  DashboardSummary,
  InvoiceFilters,
  InvoicePage,
  PortalInvoice,
  RevenueMonth,
  Subscription,
} from "@/lib/types";

const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

async function getJson<T>(path: string): Promise<T> {
  if (!apiUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is required when demo mode is disabled.");
  }

  const response = await fetch(`${apiUrl}${path}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`The API request failed (${response.status} ${response.statusText}).`);
  }

  return response.json() as Promise<T>;
}

export async function fetchDashboard(): Promise<DashboardData> {
  const [summary, revenue] = await Promise.all([
    getJson<DashboardSummary>("/reports/summary"),
    getJson<RevenueMonth[]>("/reports/revenue"),
  ]);
  return { summary, revenue };
}

export async function fetchInvoices(filters: InvoiceFilters): Promise<InvoicePage> {
  const params = new URLSearchParams({
    status: filters.status === "All statuses" ? "" : filters.status.toLowerCase(),
    customer: filters.customer,
    plan: filters.plan,
    dueFrom: filters.dueFrom,
    dueTo: filters.dueTo,
    page: String(filters.page),
    pageSize: String(filters.pageSize),
  });
  return getJson<InvoicePage>(`/invoices?${params.toString()}`);
}

export async function fetchPortal(): Promise<{
  subscriptions: Subscription[];
  invoices: PortalInvoice[];
}> {
  const [subscriptions, invoices] = await Promise.all([
    getJson<Subscription[]>("/portal/subscriptions"),
    getJson<PortalInvoice[]>("/portal/invoices"),
  ]);
  return { subscriptions, invoices };
}

export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";
