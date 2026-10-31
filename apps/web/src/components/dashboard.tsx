"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/app-shell";
import DemoBanner from "@/components/demo-banner";
import { demoDashboard, demoInvoices } from "@/lib/demo-data";
import { fetchDashboard, fetchInvoices, isDemoMode } from "@/lib/api";
import type { DashboardData, InvoiceFilters, InvoicePage, ReportInvoice } from "@/lib/types";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const pageSize = 5;

function formatCurrency(value: number) {
  return currency.format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function toLocalIsoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getInvoiceFilters(filters: Omit<InvoiceFilters, "dueFrom" | "dueTo" | "pageSize">, dateRange: string): InvoiceFilters {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - (dateRange === "Last 30 days" ? 30 : dateRange === "Last 90 days" ? 90 : 180));
  return {
    ...filters,
    dueFrom: toLocalIsoDate(start),
    dueTo: toLocalIsoDate(today),
    pageSize,
  };
}

function getDemoInvoicePage(filters: InvoiceFilters): InvoicePage {
  const matching = demoInvoices.filter((invoice) =>
    (filters.status === "All statuses" || invoice.status === filters.status)
    && invoice.customer.toLowerCase().includes(filters.customer.trim().toLowerCase())
    && invoice.plan.toLowerCase().includes(filters.plan.trim().toLowerCase())
    && invoice.dueDate >= filters.dueFrom
    && invoice.dueDate <= filters.dueTo,
  );
  const offset = (filters.page - 1) * filters.pageSize;
  return {
    items: matching.slice(offset, offset + filters.pageSize),
    total: matching.length,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

function downloadCsv(invoices: ReportInvoice[]) {
  const rows = [
    ["Invoice", "Customer", "Plan", "Due date", "Status", "Amount (INR)"],
    ...invoices.map((invoice) => [
      invoice.invoiceNumber,
      invoice.customer,
      invoice.plan,
      invoice.dueDate,
      invoice.status,
      String(invoice.amount),
    ]),
  ];
  const csv = rows.map((row) => row.map((field) => `"${field.replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "subloop-invoices.csv";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(isDemoMode ? demoDashboard : null);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("Last 6 months");
  const [dateRange, setDateRange] = useState("Last 30 days");
  const [status, setStatus] = useState<InvoiceFilters["status"]>("Overdue");
  const [customer, setCustomer] = useState("");
  const [plan, setPlan] = useState("");
  const [page, setPage] = useState(1);
  const [apiInvoices, setApiInvoices] = useState<{ key: string; page: InvoicePage } | null>(null);

  const filters = useMemo(
    () => getInvoiceFilters({ status, customer, plan, page }, dateRange),
    [status, customer, plan, page, dateRange],
  );
  const filtersKey = JSON.stringify(filters);
  const demoInvoicePage = useMemo(
    () => getDemoInvoicePage(filters),
    [filters],
  );
  const invoicePage = isDemoMode
    ? demoInvoicePage
    : apiInvoices?.key === filtersKey ? apiInvoices.page : null;

  useEffect(() => {
    if (isDemoMode) return;
    fetchDashboard().then(setData).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Could not load reports.");
    });
  }, []);

  useEffect(() => {
    if (isDemoMode) return;
    fetchInvoices(filters).then((result) => setApiInvoices({ key: filtersKey, page: result })).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Could not load invoices.");
    });
  }, [filters, filtersKey]);

  const revenueItems = period === "Last 3 months" ? (data?.revenue ?? []).slice(-3) : data?.revenue ?? [];
  const pageCount = invoicePage ? Math.max(1, Math.ceil(invoicePage.total / invoicePage.pageSize)) : 1;
  const maxRevenue = Math.ceil(Math.max(...revenueItems.map((item) => item.amount), 1) / 50000) * 50000;

  return (
    <AppShell active="dashboard" eyebrow="FINANCE OVERVIEW" title="Subscription overview" description="Here’s what’s happening with your subscriptions today.">
      {isDemoMode && <DemoBanner />}
      {error && <div className="error-box" role="alert">Couldn’t load dashboard data: {error}</div>}
      {!data && !error && <div className="loading-box">Loading finance overview…</div>}
      {data && <>
        <section className="metric-grid" aria-label="Business summary">
          <article className="metric-card">
            <div className="metric-top"><span>Active subscriptions</span><span className="metric-icon violet">↗</span></div>
            <div className="metric-value">{data.summary.activeSubscriptions.toLocaleString("en-IN")}</div>
            <div className="metric-caption"><span className="caption-neutral">Currently active</span></div>
          </article>
          <article className="metric-card">
            <div className="metric-top"><span>Monthly revenue</span><span className="metric-icon green">₹</span></div>
            <div className="metric-value">{formatCurrency(data.summary.monthlyRevenue)}</div>
            <div className="metric-caption"><span className="caption-neutral">Collected this month</span></div>
          </article>
          <article className="metric-card">
            <div className="metric-top"><span>Outstanding</span><span className="metric-icon amber">◷</span></div>
            <div className="metric-value">{formatCurrency(data.summary.outstanding)}</div>
            <div className="metric-caption"><span className="caption-neutral">Across {data.summary.unpaidInvoiceCount} invoices</span></div>
          </article>
          <article className="metric-card">
            <div className="metric-top"><span>Overdue invoices</span><span className="metric-icon red">!</span></div>
            <div className="metric-value">{data.summary.overdueCount}</div>
            <div className="metric-caption"><span className="trend-negative">Needs attention</span> <span>past due date</span></div>
          </article>
        </section>

        <section className="chart-grid">
          <article className="panel revenue-panel">
            <div className="panel-heading"><div><h2>Revenue over time</h2><p>Monthly recurring revenue collected</p></div><select className="select-button" aria-label="Revenue chart period" value={period} onChange={(event) => setPeriod(event.target.value)}><option>Last 6 months</option><option>Last 3 months</option></select></div>
            <div className="revenue-total">{formatCurrency(data.summary.monthlyRevenue)}</div>
            <div className="chart-area" aria-label="Monthly revenue chart">
              <div className="chart-y-labels"><span>{formatCurrency(maxRevenue)}</span><span>{formatCurrency(maxRevenue * .75)}</span><span>{formatCurrency(maxRevenue * .5)}</span><span>{formatCurrency(maxRevenue * .25)}</span><span>₹0</span></div>
              <div className="chart-content">
                <div className="chart-gridlines"><i /><i /><i /><i /><i /></div>
                <div className="bar-chart">{revenueItems.map((item, index) => {
                  return <div className="bar-column" key={item.month}><div className={`bar ${index === revenueItems.length - 1 ? "bar-current" : ""}`} style={{ height: `${Math.max(7, (item.amount / maxRevenue) * 100)}%` }} title={`${item.month}: ${formatCurrency(item.amount)}`} /><span>{item.month}</span></div>;
                })}</div>
              </div>
            </div>
          </article>
          <article className="panel payment-panel">
            <div className="panel-heading"><div><h2>Payments by method</h2><p>Collected this month</p></div><span className="more-button" aria-hidden="true">···</span></div>
            <div className="payment-total">{formatCurrency(data.summary.paymentsByMethod.reduce((sum, item) => sum + item.amount, 0))}</div>
            <div className="payment-list">
              {data.summary.paymentsByMethod.map((item, index) => {
                const total = data.summary.paymentsByMethod.reduce((sum, method) => sum + method.amount, 0) || 1;
                const colors = ["#7464e8", "#50b99a", "#f2af5c", "#e57c7c"];
                return <div className="payment-row" key={item.method}><div className="payment-row-label"><span className="payment-dot" style={{ backgroundColor: colors[index % colors.length] }} />{item.method}<strong>{formatCurrency(item.amount)}</strong></div><div className="payment-track"><span style={{ width: `${(item.amount / total) * 100}%`, backgroundColor: colors[index % colors.length] }} /></div></div>;
              })}
            </div>
          </article>
        </section>

        <section className="panel overdue-panel">
          <div className="panel-heading overdue-heading">
            <div><div className="table-title"><h2>Invoices</h2><span className="count-badge">{invoicePage?.total ?? "…"}</span></div><p>Filter invoices by status, due date, customer, and plan.</p></div>
            <button className="outline-button" disabled={!invoicePage} onClick={() => downloadCsv(invoicePage?.items ?? [])}>↓ &nbsp;Export page</button>
          </div>
          <div className="invoice-filters" aria-label="Invoice filters">
            <select className="filter-select" aria-label="Filter by due date" value={dateRange} onChange={(event) => { setDateRange(event.target.value); setPage(1); }}><option>Last 30 days</option><option>Last 90 days</option><option>Last 6 months</option></select>
            <select className="filter-select" aria-label="Filter by status" value={status} onChange={(event) => { setStatus(event.target.value as InvoiceFilters["status"]); setPage(1); }}><option>All statuses</option><option>Overdue</option><option>Outstanding</option><option>Paid</option></select>
            <input className="filter-input" aria-label="Filter by customer" placeholder="Customer" value={customer} onChange={(event) => { setCustomer(event.target.value); setPage(1); }} />
            <input className="filter-input" aria-label="Filter by plan" placeholder="Plan" value={plan} onChange={(event) => { setPlan(event.target.value); setPage(1); }} />
          </div>
          <div className="table-wrap"><table><thead><tr><th>INVOICE</th><th>CUSTOMER</th><th>PLAN</th><th>DUE DATE</th><th>AMOUNT</th><th>STATUS</th></tr></thead><tbody>
            {invoicePage?.items.map((invoice) => <tr key={invoice.invoiceNumber}><td className="invoice-number">{invoice.invoiceNumber}</td><td><span className="customer-cell-avatar">{invoice.customer.slice(0, 1)}</span>{invoice.customer}</td><td>{invoice.plan}</td><td>{formatDate(invoice.dueDate)}</td><td className="amount-cell">{formatCurrency(invoice.amount)}</td><td><span className={`status-pill status-${invoice.status.toLowerCase()}`}><i /> {invoice.status}</span></td></tr>)}
            {invoicePage && invoicePage.items.length === 0 && <tr><td className="empty-row" colSpan={6}>No invoices match these filters.</td></tr>}
            {!invoicePage && <tr><td className="empty-row" colSpan={6}>Loading invoices…</td></tr>}
          </tbody></table></div>
          <div className="table-footer"><span>Showing <strong>{invoicePage?.items.length ?? 0}</strong> of <strong>{invoicePage?.total ?? 0}</strong> matching invoices</span><div className="pagination"><button className="outline-button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {pageCount}</span><button className="outline-button" disabled={!invoicePage || page >= pageCount} onClick={() => setPage((current) => current + 1)}>Next</button></div></div>
        </section>
        <section className="renewal-callout"><span className="renewal-icon">✦</span><div><strong>Your next renewal wave is coming up</strong><span>{data.summary.upcomingRenewalCount} subscriptions renew in the next 30 days. Make sure everything is ready.</span></div></section>
        <section className="demo-guide" id="demo-guide"><span className="guide-number">01</span><div><strong>Demo guide</strong><span>Explore the finance dashboard, then switch to the customer portal to see the subscriber experience.</span></div><a href="/portal">Open customer portal <span aria-hidden="true">→</span></a></section>
      </>}
    </AppShell>
  );
}
