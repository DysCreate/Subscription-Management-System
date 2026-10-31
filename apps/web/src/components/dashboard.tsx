"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/app-shell";
import DemoBanner from "@/components/demo-banner";
import {
  createInitialBillingState,
  getBillingStorageKey,
  getInvoiceDisplayStatus,
  isBillingDemoState,
  normalizeBillingDemoState,
  recordDemoPayment,
  runBilling as runDemoBilling,
} from "@/lib/billing-demo";
import { demoDashboard } from "@/lib/demo-data";
import { fetchDashboard, fetchInvoices, isDemoMode } from "@/lib/api";
import type {
  BillingDemoState,
  BillingDiscountRule,
  BillingInvoice,
  PaymentMethod,
} from "@/lib/billing-demo";
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

function addDaysToIsoDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toLocalIsoDate(date);
}

function getInvoiceFilters(filters: Omit<InvoiceFilters, "dueFrom" | "dueTo" | "pageSize">, dateRange: string): InvoiceFilters {
  const today = new Date();
  const start = new Date(today);
  const end = new Date(today);
  if (dateRange === "Upcoming 90 days") {
    end.setDate(end.getDate() + 90);
  } else {
    start.setDate(start.getDate() - (dateRange === "Last 30 days" ? 30 : dateRange === "Last 90 days" ? 90 : 180));
  }
  return {
    ...filters,
    dueFrom: toLocalIsoDate(start),
    dueTo: toLocalIsoDate(end),
    pageSize,
  };
}

function getDemoInvoicePage(filters: InvoiceFilters, source: BillingInvoice[], today: string): {
  items: BillingInvoice[];
  total: number;
  page: number;
  pageSize: number;
} {
  const matching = source.filter((invoice) =>
    (filters.status === "All statuses" || getInvoiceDisplayStatus(invoice, today) === filters.status)
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

function downloadCsv(invoices: Array<Omit<ReportInvoice, "status"> & { status: string }>) {
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
  const [billing, setBilling] = useState<BillingDemoState>(() => createInitialBillingState(toLocalIsoDate(new Date())));
  const [billingHydrated, setBillingHydrated] = useState(false);
  const [discountEditingId, setDiscountEditingId] = useState<string | null>(null);
  const [printedInvoice, setPrintedInvoice] = useState<BillingInvoice | null>(null);
  const [discountForm, setDiscountForm] = useState({
    name: "",
    type: "percent" as BillingDiscountRule["type"],
    value: "10",
    minPurchase: "0",
    minQuantity: "1",
    startsOn: toLocalIsoDate(new Date()),
    endsOn: addDaysToIsoDate(toLocalIsoDate(new Date()), 30),
    usageLimit: "10",
    scope: "subscription" as BillingDiscountRule["scope"],
    product: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    invoiceNumber: "INV-00241",
    method: "UPI" as PaymentMethod,
    amount: "1000",
    note: "",
  });
  const [billingNotice, setBillingNotice] = useState("Billing automation is ready for the next run and has 18 renewals queued.");
  const [actionError, setActionError] = useState("");

  const filters = useMemo(
    () => getInvoiceFilters({ status, customer, plan, page }, dateRange),
    [status, customer, plan, page, dateRange],
  );
  const filtersKey = JSON.stringify(filters);
  const today = toLocalIsoDate(new Date());
  const demoInvoicePage = useMemo(
    () => getDemoInvoicePage(filters, billing.invoices, today),
    [filters, billing.invoices, today],
  );
  const invoicePage = isDemoMode
    ? demoInvoicePage
    : apiInvoices?.key === filtersKey ? apiInvoices.page : null;

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      try {
        if (isDemoMode) {
          const saved = window.localStorage.getItem(getBillingStorageKey());
          if (saved) {
            const parsed: unknown = JSON.parse(saved);
            if (!isBillingDemoState(parsed)) {
              throw new Error("Saved billing demo data has an invalid format.");
            }
            setBilling(normalizeBillingDemoState(parsed));
          }
        }
      } catch (cause: unknown) {
        setError(cause instanceof Error ? cause.message : "Could not load saved billing demo data.");
      } finally {
        setBillingHydrated(true);
      }
    });
    return () => { active = false; };
  }, []);

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
  const activeDiscountCount = billing.discounts.filter((rule) => rule.active
    && rule.timesUsed < rule.usageLimit
    && rule.startsOn <= today
    && rule.endsOn >= today).length;
  const totalDiscountsApplied = billing.invoices.reduce((sum, invoice) => sum + invoice.discountTotal, 0);
  const totalCollectedThisCycle = billing.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const openInvoices = billing.invoices.filter((invoice) => invoice.status === "Confirmed");
  const selectedPaymentInvoice = openInvoices.find((invoice) => invoice.invoiceNumber === paymentForm.invoiceNumber);
  const createdInvoicesCount = billing.invoices.filter((invoice) => invoice.subscriptionId !== null).length;
  const billingHighlights = [
    { label: "Invoices generated", value: billing.invoices.length.toLocaleString("en-IN"), note: `${createdInvoicesCount} from billing runs`, tone: "violet" },
    { label: "Discount applied", value: formatCurrency(totalDiscountsApplied), note: `${activeDiscountCount} rules active`, tone: "green" },
    { label: "Payments posted", value: formatCurrency(totalCollectedThisCycle), note: `${billing.payments.length} payment record(s)`, tone: "amber" },
  ];
  const paymentMethods = ["UPI", "Bank transfer", "Card", "Cash", "Cheque"] as const;
  const paymentActivity = paymentMethods.map((method) => {
    const records = billing.payments.filter((payment) => payment.method === method);
    const amount = records.reduce((sum, payment) => sum + payment.amount, 0);
    return { method, amount, count: records.length };
  }).filter((method) => method.count > 0);
  const paymentChart = isDemoMode ? paymentActivity : data?.summary.paymentsByMethod ?? [];
  const paymentTotal = paymentChart.reduce((sum, item) => sum + item.amount, 0);
  const paymentColors = ["#b6f0dc", "#a99cf7", "#ffd38a", "#f79a9a"];
  const paymentGradient = paymentChart.reduce(
    (result, item, index) => {
      const end = result.offset + (paymentTotal ? (item.amount / paymentTotal) * 100 : 0);
      return {
        offset: end,
        segments: [...result.segments, `${paymentColors[index % paymentColors.length]} ${result.offset}% ${end}%`],
      };
    },
    { offset: 0, segments: [] as string[] },
  ).segments.join(", ");

  const persistBilling = (next: BillingDemoState) => {
    const normalized = normalizeBillingDemoState(next);
    setBilling(normalized);
    if (!isDemoMode) return;
    try {
      window.localStorage.setItem(getBillingStorageKey(), JSON.stringify(normalized));
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not save billing demo data.");
    }
  };

  const runBilling = () => {
    if (!isDemoMode || !billingHydrated) return;
    setActionError("");
    const result = runDemoBilling(billing, today);
    persistBilling(result.state);
    if (result.created.length) {
      const names = result.created.map((invoice) => invoice.invoiceNumber).join(", ");
      setBillingNotice(`Billing run complete: ${result.created.length} draft invoice(s) created (${names}); ${result.skipped} subscription(s) skipped.`);
      setPaymentForm((current) => ({ ...current, invoiceNumber: result.created[0].invoiceNumber }));
      setDateRange("Upcoming 90 days");
      setStatus("All statuses");
      setPage(1);
    } else {
      setBillingNotice(`Billing run complete: no invoices created; ${result.skipped} subscription(s) skipped, ${result.failed} failed. No duplicate billing periods were created.`);
    }
  };

  const resetBillingDemo = () => {
    if (!window.confirm("Reset billing demo data? This removes demo invoices, payments and discount changes saved in this browser.")) return;
    persistBilling(createInitialBillingState(today));
    setPaymentForm({ invoiceNumber: "INV-00241", method: "UPI", amount: "1000", note: "" });
    setDateRange("Last 30 days");
    setStatus("Overdue");
    setCustomer("");
    setPlan("");
    setPage(1);
    setActionError("");
    setBillingNotice("Billing demo data has been reset.");
  };

  const resetDiscountForm = () => {
    setDiscountEditingId(null);
    setDiscountForm({
      name: "",
      type: "percent",
      value: "10",
      minPurchase: "0",
      minQuantity: "1",
      startsOn: today,
      endsOn: addDaysToIsoDate(today, 30),
      usageLimit: "10",
      scope: "subscription",
      product: "",
    });
  };

  const saveDiscountRule = () => {
    const value = Number(discountForm.value);
    const minPurchase = Number(discountForm.minPurchase);
    const minQuantity = Number(discountForm.minQuantity);
    const usageLimit = Number(discountForm.usageLimit);
    if (!discountForm.name.trim()) {
      setActionError("Enter a name for the discount rule.");
      return;
    }
    if (billing.discounts.some((rule) =>
      rule.id !== discountEditingId
      && rule.name.toLowerCase() === discountForm.name.trim().toLowerCase()
    )) {
      setActionError("A discount rule with that name already exists.");
      return;
    }
    if (!Number.isFinite(value) || value <= 0 || (discountForm.type === "percent" && value > 100)) {
      setActionError(discountForm.type === "percent" ? "Percentage discounts must be from 0 to 100." : "Enter a fixed discount greater than zero.");
      return;
    }
    if (!Number.isFinite(minPurchase) || minPurchase < 0 || !Number.isInteger(minQuantity) || minQuantity < 1) {
      setActionError("Minimum purchase must be non-negative and minimum quantity must be at least one.");
      return;
    }
    if (!discountForm.startsOn || !discountForm.endsOn || discountForm.endsOn < discountForm.startsOn) {
      setActionError("Choose a valid date window for the discount.");
      return;
    }
    if (!Number.isInteger(usageLimit) || usageLimit < 1) {
      setActionError("Usage limit must be a whole number greater than zero.");
      return;
    }
    if (discountForm.scope === "product" && !discountForm.product.trim()) {
      setActionError("Choose a product for a product-scoped discount.");
      return;
    }

    const rule: BillingDiscountRule = {
      id: discountEditingId ?? `discount-${window.crypto.randomUUID()}`,
      name: discountForm.name.trim(),
      type: discountForm.type,
      value,
      minPurchase,
      minQuantity,
      startsOn: discountForm.startsOn,
      endsOn: discountForm.endsOn,
      usageLimit,
      timesUsed: billing.discounts.find((item) => item.id === discountEditingId)?.timesUsed ?? 0,
      scope: discountForm.scope,
      product: discountForm.scope === "product" ? discountForm.product.trim() : "",
      active: true,
    };
    persistBilling({
      ...billing,
      discounts: discountEditingId
        ? billing.discounts.map((item) => item.id === discountEditingId ? { ...rule, active: item.active } : item)
        : [...billing.discounts, rule],
    });
    setActionError("");
    setBillingNotice(`Discount rule “${rule.name}” ${discountEditingId ? "updated" : "created"} and will be evaluated on the next eligible invoice.`);
    resetDiscountForm();
  };

  const editDiscountRule = (rule: BillingDiscountRule) => {
    setDiscountEditingId(rule.id);
    setDiscountForm({
      name: rule.name,
      type: rule.type,
      value: String(rule.value),
      minPurchase: String(rule.minPurchase),
      minQuantity: String(rule.minQuantity),
      startsOn: rule.startsOn,
      endsOn: rule.endsOn,
      usageLimit: String(rule.usageLimit),
      scope: rule.scope,
      product: rule.product,
    });
    setActionError("");
  };

  const toggleDiscountRule = (id: string) => {
    const target = billing.discounts.find((rule) => rule.id === id);
    if (!target) return;
    if (!target.active && (target.timesUsed >= target.usageLimit || target.endsOn < today)) {
      setActionError("This rule has expired or reached its usage limit. Edit its dates or limit before activating it.");
      return;
    }
    persistBilling({
      ...billing,
      discounts: billing.discounts.map((rule) => rule.id === id
        ? { ...rule, active: !rule.active }
        : rule),
    });
    setActionError("");
  };

  const deleteDiscountRule = (rule: BillingDiscountRule) => {
    if (rule.timesUsed > 0) {
      setActionError("A discount already used on an invoice cannot be deleted. You can deactivate it instead.");
      return;
    }
    persistBilling({ ...billing, discounts: billing.discounts.filter((item) => item.id !== rule.id) });
    setActionError("");
  };

  const updateInvoiceStatus = (invoiceNumber: string, nextStatus: "Confirmed" | "Cancelled") => {
    const invoice = billing.invoices.find((item) => item.invoiceNumber === invoiceNumber);
    if (!invoice) return;
    if (invoice.status !== "Draft" && !(nextStatus === "Cancelled" && invoice.status === "Confirmed" && invoice.paidAmount === 0)) {
      setActionError("This invoice can no longer be changed.");
      return;
    }
    persistBilling({
      ...billing,
      invoices: billing.invoices.map((item) => item.invoiceNumber === invoiceNumber ? { ...item, status: nextStatus } : item),
    });
    setActionError("");
    setBillingNotice(`${invoiceNumber} is now ${nextStatus.toLowerCase()}.`);
  };

  const markInvoiceSent = (invoice: BillingInvoice) => {
    if (invoice.status !== "Confirmed" || invoice.sentAt) return;
    persistBilling({
      ...billing,
      invoices: billing.invoices.map((item) => item.invoiceNumber === invoice.invoiceNumber
        ? { ...item, sentAt: today }
        : item),
    });
    setBillingNotice(`${invoice.invoiceNumber} marked as sent in the demo; no email was delivered.`);
  };

  const printInvoice = (invoice: BillingInvoice) => {
    setPrintedInvoice(invoice);
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => setPrintedInvoice(null), 1000);
    }, 100);
  };

  const recordPayment = () => {
    const amount = Number(paymentForm.amount);
    const result = recordDemoPayment(billing, {
      invoiceNumber: paymentForm.invoiceNumber,
      method: paymentForm.method,
      amount,
      note: paymentForm.note.trim() || "Manual settlement",
      paidOn: today,
    }, today);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    persistBilling(result.state);
    setActionError("");
    setBillingNotice(`Payment of ${formatCurrency(amount)} recorded against ${paymentForm.invoiceNumber}.`);
    const remaining = result.state.invoices.find((invoice) => invoice.invoiceNumber === paymentForm.invoiceNumber);
    setPaymentForm((current) => ({ ...current, amount: remaining ? String(Math.max(0, remaining.total - remaining.paidAmount)) : "" }));
  };

  const invoiceRows: Array<Omit<ReportInvoice, "status"> & { status: string }> = isDemoMode
    ? demoInvoicePage.items.map((invoice) => ({
      invoiceNumber: invoice.invoiceNumber,
      customer: invoice.customer,
      plan: invoice.plan,
      dueDate: invoice.dueDate,
      amount: invoice.total,
      status: getInvoiceDisplayStatus(invoice, today),
    }))
    : apiInvoices?.key === filtersKey ? apiInvoices.page.items : [];

  return (
    <AppShell active="dashboard" eyebrow="YOUR BUSINESS, IN FOCUS" title="Revenue command center" description="Keep billing moving, turn renewals into revenue, and spot what needs attention.">
      {isDemoMode && <DemoBanner />}
      {error && <div className="error-box" role="alert">Couldn’t load dashboard data: {error}</div>}
      {actionError && <div className="error-box" role="alert">{actionError}</div>}
      {!data && !error && <div className="loading-box">Loading finance overview…</div>}
      {data && <>
        <section className="dashboard-hero">
          <div className="hero-copy">
            <span className="hero-kicker"><i /> REVENUE SNAPSHOT</span>
            <h2>Built on recurring.<br /><span>Ready for what’s next.</span></h2>
            <p>Your subscription engine at a glance. Billing, discounts, and collections in sync.</p>
            <a className="hero-link" href="#billing-workflow">Explore billing activity <span aria-hidden="true">↘</span></a>
          </div>
          <div className="hero-amount">
            <span>MONTHLY REVENUE</span>
            <strong>{formatCurrency(data.summary.monthlyRevenue)}</strong>
            <small><i /> Collected this month</small>
          </div>
          <div className="hero-orbit hero-orbit-one" />
          <div className="hero-orbit hero-orbit-two" />
          <span className="hero-decoration" aria-hidden="true">S</span>
        </section>

        <section className="metric-grid" aria-label="Business summary">
          <article className="metric-card">
            <div className="metric-top"><span>Active subscriptions</span><span className="metric-icon violet">↗</span></div>
            <div className="metric-value">{data.summary.activeSubscriptions.toLocaleString("en-IN")}</div>
            <div className="metric-caption"><span className="metric-dot dot-violet" />Currently active</div>
          </article>
          <article className="metric-card">
            <div className="metric-top"><span>Monthly revenue</span><span className="metric-icon green">₹</span></div>
            <div className="metric-value">{formatCurrency(data.summary.monthlyRevenue)}</div>
            <div className="metric-caption"><span className="metric-dot dot-green" />Collected this month</div>
          </article>
          <article className="metric-card">
            <div className="metric-top"><span>Outstanding</span><span className="metric-icon amber">◷</span></div>
            <div className="metric-value">{formatCurrency(data.summary.outstanding)}</div>
            <div className="metric-caption"><span className="metric-dot dot-amber" />Across {data.summary.unpaidInvoiceCount} invoices</div>
          </article>
          <article className="metric-card">
            <div className="metric-top"><span>Overdue invoices</span><span className="metric-icon red">!</span></div>
            <div className="metric-value">{data.summary.overdueCount}</div>
            <div className="metric-caption"><span className="metric-dot dot-red" />{data.summary.overdueCount ? "Needs attention" : "All clear"}</div>
          </article>
        </section>

        <section className="module-grid" aria-label="Billing operations overview">
          <article className="panel module-panel">
            <div className="panel-heading"><div><span className="panel-overline">AUTOMATION</span><h2>Billing control</h2><p>Invoice automation and run summary</p></div><button className="primary-button" disabled={!isDemoMode || !billingHydrated} onClick={runBilling}>Run billing now <span aria-hidden="true">→</span></button></div>
            <div className="module-metrics">
              {billingHighlights.map((item) => (
                <div key={item.label} className={`module-stat ${item.tone}`}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <small>{item.note}</small>
                </div>
              ))}
            </div>
            <div className="pipeline-status">
              <div><span className="status-dot success" /> Draft invoices <strong>{billing.invoices.filter((invoice) => invoice.status === "Draft").length}</strong></div>
              <div><span className="status-dot warning" /> Confirmed <strong>{billing.invoices.filter((invoice) => invoice.status === "Confirmed").length}</strong></div>
              <div><span className="status-dot neutral" /> Paid <strong>{billing.invoices.filter((invoice) => invoice.status === "Paid").length}</strong></div>
            </div>
          </article>
          <article className="panel module-panel">
            <div className="panel-heading"><div><span className="panel-overline">SMART SAVINGS</span><h2>Discount rules</h2><p>{activeDiscountCount} active · limits and dates enforced</p></div><a className="outline-button" href="#discount-engine">Manage rules <span aria-hidden="true">↗</span></a></div>
            <ul className="mini-list">
              {billing.discounts.slice(0, 3).map((rule) => (
                <li key={rule.id}>
                  <div>
                    <strong>{rule.name}</strong>
                    <span>{rule.type === "percent" ? `${rule.value}% off` : `${formatCurrency(rule.value)} off`}</span>
                  </div>
                  <div className="list-meta">
                    <small>{rule.timesUsed}/{rule.usageLimit} used</small>
                    <span className={`status-chip ${rule.active ? "status-paid" : "status-pending"}`}>{rule.active ? "Active" : "Paused"}</span>
                  </div>
                </li>
              ))}
              {billing.discounts.length === 0 && <li><span>No discount rules created yet.</span></li>}
            </ul>
          </article>
          <article className="panel module-panel">
            <div className="panel-heading"><div><span className="panel-overline">CASH FLOW</span><h2>Payment collection</h2><p>{billing.payments.length} recorded payment(s)</p></div><a className="outline-button" href="#payment-ledger">View ledger <span aria-hidden="true">↗</span></a></div>
            <div className="method-stack">
              {paymentActivity.map((method) => (
                <div key={method.method} className="method-row">
                  <div>
                    <strong>{method.method}</strong>
                    <span>{method.count} payment(s)</span>
                  </div>
                  <b>{formatCurrency(method.amount)}</b>
                </div>
              ))}
              {paymentActivity.length === 0 && <div className="empty-state">No payments posted yet.</div>}
            </div>
          </article>
        </section>

        <section className="chart-grid">
          <article className="panel revenue-panel">
            <div className="panel-heading"><div className="panel-title-block"><span className="panel-overline">REVENUE TRENDS</span><h2>Revenue over time</h2><p>Monthly recurring revenue collected</p></div><select className="select-button" aria-label="Revenue chart period" value={period} onChange={(event) => setPeriod(event.target.value)}><option>Last 6 months</option><option>Last 3 months</option></select></div>
            <div className="chart-summary"><div className="revenue-total">{formatCurrency(data.summary.monthlyRevenue)}</div><span className="chart-context"><i /> Monthly total</span></div>
            <div className="chart-area" aria-label="Monthly revenue chart">
              <div className="chart-y-labels"><span>{formatCurrency(maxRevenue)}</span><span>{formatCurrency(maxRevenue * .75)}</span><span>{formatCurrency(maxRevenue * .5)}</span><span>{formatCurrency(maxRevenue * .25)}</span><span>₹0</span></div>
              <div className="chart-content">
                <div className="chart-gridlines"><i /><i /><i /><i /><i /></div>
                <div className="bar-chart">{revenueItems.map((item, index) => (
                  <div className={`bar-column ${index === revenueItems.length - 1 ? "bar-column-current" : ""}`} key={item.month}><span className="bar-tooltip">{formatCurrency(item.amount)}</span><div className="bar" style={{ height: `${Math.max(7, (item.amount / maxRevenue) * 100)}%` }} title={`${item.month}: ${formatCurrency(item.amount)}`} /><span className="bar-month">{item.month}</span></div>
                ))}</div>
              </div>
            </div>
          </article>
          <article className="panel payment-panel">
            <div className="panel-heading"><div className="panel-title-block"><span className="panel-overline">COLLECTION MIX</span><h2>Payments by method</h2><p>{isDemoMode ? "Recorded in this browser" : "Collected this month"}</p></div><span className="payment-card-mark" aria-hidden="true">↗</span></div>
            <div className="payment-visual">
              <div className="payment-donut" role="img" aria-label={`Payments collected: ${formatCurrency(paymentTotal)}`} style={{ background: `conic-gradient(${paymentGradient || "#e9eaf1 0% 100%"})` }}>
                <div className="payment-donut-center"><strong>{formatCurrency(paymentTotal)}</strong><span>COLLECTED</span></div>
              </div>
              <div className="payment-list">
                {paymentChart.map((item, index) => {
                  const percentage = paymentTotal ? Math.round((item.amount / paymentTotal) * 100) : 0;
                  return <div className="payment-row" key={item.method}><div className="payment-row-label"><span className="payment-dot" style={{ backgroundColor: paymentColors[index % paymentColors.length] }} />{item.method}<strong>{percentage}%</strong></div><span className="payment-row-amount">{formatCurrency(item.amount)}</span></div>;
                })}
                {paymentChart.length === 0 && <div className="empty-state">No payments posted yet.</div>}
              </div>
            </div>
          </article>
        </section>

        <section className="workflow-grid" id="billing-workflow">
          <article className="panel workflow-panel">
            <div className="panel-heading"><div><span className="panel-overline">BILLING ENGINE</span><h2>Billing workflow</h2><p>Run the next billing batch and review the ledger.</p></div><div className="workflow-actions"><button className="outline-button" disabled={!isDemoMode} onClick={resetBillingDemo}>Reset demo</button><button className="primary-button" disabled={!isDemoMode || !billingHydrated} onClick={runBilling}>Run billing now</button></div></div>
            <div className="workflow-banner" role="status">{billingNotice}</div>
            {billing.lastRun && <div className="run-summary" role="status">Last run {formatDate(billing.lastRun.ranAt)}: {billing.lastRun.created} created · {billing.lastRun.skipped} skipped · {billing.lastRun.failed} failed.</div>}
            <div className="workflow-summary">
              <div>
                <span>Latest generated invoice</span>
                <strong>{billing.invoices.find((invoice) => invoice.subscriptionId !== null)?.invoiceNumber ?? "—"}</strong>
              </div>
              <div>
                <span>Payments recorded</span>
                <strong>{formatCurrency(totalCollectedThisCycle)}</strong>
              </div>
              <div>
                <span>Open balance</span>
                <strong>{formatCurrency(billing.invoices.filter((invoice) => invoice.status === "Confirmed").reduce((sum, invoice) => sum + invoice.total - invoice.paidAmount, 0))}</strong>
              </div>
            </div>
          </article>

          <article className="panel workflow-panel">
            <div className="panel-heading"><div><h2>Record payment</h2><p>Post a payment to an open invoice.</p></div></div>
            <div className="payment-form">
              <label>
                Invoice
                <select value={paymentForm.invoiceNumber} onChange={(event) => setPaymentForm((current) => ({ ...current, invoiceNumber: event.target.value }))} disabled={!isDemoMode || openInvoices.length === 0}>
                  {openInvoices.map((invoice) => (
                    <option key={invoice.invoiceNumber} value={invoice.invoiceNumber}>{invoice.invoiceNumber} · balance {formatCurrency(invoice.total - invoice.paidAmount)}</option>
                  ))}
                </select>
              </label>
              <label>
                Method
                <select value={paymentForm.method} onChange={(event) => setPaymentForm((current) => ({ ...current, method: event.target.value as PaymentMethod }))} disabled={!isDemoMode}>
                  {paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
                </select>
              </label>
              <label>
                Amount
                <input type="number" min="0.01" step="0.01" max={selectedPaymentInvoice ? selectedPaymentInvoice.total - selectedPaymentInvoice.paidAmount : undefined} value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} disabled={!isDemoMode} />
              </label>
              <label>
                Note
                <input type="text" value={paymentForm.note} onChange={(event) => setPaymentForm((current) => ({ ...current, note: event.target.value }))} disabled={!isDemoMode} />
              </label>
              <button className="primary-button payment-submit" disabled={!isDemoMode || !selectedPaymentInvoice || Number(paymentForm.amount) <= 0} onClick={recordPayment}>Post payment</button>
              {selectedPaymentInvoice && <small className="form-hint">Remaining balance: {formatCurrency(selectedPaymentInvoice.total - selectedPaymentInvoice.paidAmount)}</small>}
              {openInvoices.length === 0 && <small className="form-hint">Confirm a draft invoice to accept payments.</small>}
            </div>
          </article>

          <article className="panel workflow-panel" id="discount-engine">
            <div className="panel-heading"><div><h2>Discount engine</h2><p>Apply or pause discount rules.</p></div></div>
            <form className="discount-form" onSubmit={(event) => { event.preventDefault(); saveDiscountRule(); }}>
              <label>Rule name<input required disabled={!isDemoMode} value={discountForm.name} onChange={(event) => setDiscountForm((current) => ({ ...current, name: event.target.value }))} /></label>
              <div className="form-row">
                <label>Type<select disabled={!isDemoMode} value={discountForm.type} onChange={(event) => setDiscountForm((current) => ({ ...current, type: event.target.value as BillingDiscountRule["type"] }))}><option value="percent">Percent</option><option value="fixed">Fixed amount</option></select></label>
                <label>Value<input type="number" min="0.01" step="0.01" disabled={!isDemoMode} value={discountForm.value} onChange={(event) => setDiscountForm((current) => ({ ...current, value: event.target.value }))} /></label>
              </div>
              <div className="form-row">
                <label>Min. purchase (₹)<input type="number" min="0" step="0.01" disabled={!isDemoMode} value={discountForm.minPurchase} onChange={(event) => setDiscountForm((current) => ({ ...current, minPurchase: event.target.value }))} /></label>
                <label>Min. quantity<input type="number" min="1" step="1" disabled={!isDemoMode} value={discountForm.minQuantity} onChange={(event) => setDiscountForm((current) => ({ ...current, minQuantity: event.target.value }))} /></label>
              </div>
              <div className="form-row">
                <label>Starts<input type="date" disabled={!isDemoMode} value={discountForm.startsOn} onChange={(event) => setDiscountForm((current) => ({ ...current, startsOn: event.target.value }))} /></label>
                <label>Ends<input type="date" disabled={!isDemoMode} value={discountForm.endsOn} onChange={(event) => setDiscountForm((current) => ({ ...current, endsOn: event.target.value }))} /></label>
              </div>
              <div className="form-row">
                <label>Usage limit<input type="number" min="1" step="1" disabled={!isDemoMode} value={discountForm.usageLimit} onChange={(event) => setDiscountForm((current) => ({ ...current, usageLimit: event.target.value }))} /></label>
                <label>Scope<select disabled={!isDemoMode} value={discountForm.scope} onChange={(event) => setDiscountForm((current) => ({ ...current, scope: event.target.value as BillingDiscountRule["scope"] }))}><option value="subscription">Subscription</option><option value="product">Product</option></select></label>
              </div>
              {discountForm.scope === "product" && <label>Product<input required disabled={!isDemoMode} value={discountForm.product} onChange={(event) => setDiscountForm((current) => ({ ...current, product: event.target.value }))} placeholder="e.g. Starter" /></label>}
              <div className="form-actions"><button className="primary-button" type="submit" disabled={!isDemoMode}>{discountEditingId ? "Save changes" : "Add rule"}</button>{discountEditingId && <button className="outline-button" type="button" disabled={!isDemoMode} onClick={resetDiscountForm}>Cancel edit</button>}</div>
            </form>
            <div className="rule-list">
              {billing.discounts.map((rule) => {
                const unavailable = rule.timesUsed >= rule.usageLimit || rule.endsOn < today;
                const ruleStatus = rule.timesUsed >= rule.usageLimit
                  ? "Limit reached"
                  : rule.endsOn < today
                    ? "Expired"
                    : rule.active && rule.startsOn > today
                      ? "Scheduled"
                      : rule.active ? "Active" : "Paused";
                return (
                  <div key={rule.id} className="rule-item">
                    <div>
                      <strong>{rule.name}</strong>
                      <span>{rule.type === "percent" ? `${rule.value}% off` : `${formatCurrency(rule.value)} off`} · {rule.scope}{rule.scope === "product" ? `: ${rule.product}` : ""}</span>
                      <span>Min. {formatCurrency(rule.minPurchase)} · qty {rule.minQuantity} · {rule.startsOn} to {rule.endsOn}</span>
                      <span>{rule.timesUsed}/{rule.usageLimit} uses</span>
                    </div>
                    <div className="rule-meta">
                      <button className={`mini-toggle ${rule.active ? "active" : "paused"}`} disabled={!isDemoMode || unavailable} onClick={() => toggleDiscountRule(rule.id)}>{ruleStatus}</button>
                      <button className="text-button" disabled={!isDemoMode} onClick={() => editDiscountRule(rule)}>Edit</button>
                      <button className="text-button danger-text" disabled={!isDemoMode || rule.timesUsed > 0} onClick={() => deleteDiscountRule(rule)}>Delete</button>
                    </div>
                  </div>
                );
              })}
              {billing.discounts.length === 0 && <div className="empty-state">No discount rules created yet.</div>}
            </div>
          </article>
        </section>

        <section className="panel ledger-panel" id="payment-ledger">
          <div className="panel-heading overdue-heading"><div><h2>Payment ledger</h2><p>Recorded payments against invoices.</p></div></div>
          <div className="table-wrap"><table><thead><tr><th>PAYMENT</th><th>INVOICE</th><th>METHOD</th><th>DATE</th><th>NOTE</th><th>AMOUNT</th></tr></thead><tbody>
            {billing.payments.map((payment) => <tr key={payment.id}><td className="invoice-number">{payment.id}</td><td>{payment.invoiceNumber}</td><td>{payment.method}</td><td>{formatDate(payment.paidOn)}</td><td>{payment.note}</td><td className="amount-cell">{formatCurrency(payment.amount)}</td></tr>)}
            {billing.payments.length === 0 && <tr><td className="empty-row" colSpan={6}>No payments recorded yet. Confirm an invoice and post a payment to create the first ledger entry.</td></tr>}
          </tbody></table></div>
        </section>

        <section className="panel overdue-panel" id="invoice-center">
          <div className="panel-heading overdue-heading">
            <div><span className="panel-overline">ACCOUNTS RECEIVABLE</span><div className="table-title"><h2>Invoice center</h2><span className="count-badge">{invoicePage?.total ?? "…"}</span></div><p>See what’s paid, what’s pending, and what needs a nudge.</p></div>
            <button className="outline-button export-button" disabled={!invoicePage} onClick={() => downloadCsv(invoiceRows)}><span aria-hidden="true">↓</span> Export current page</button>
          </div>
          <div className="invoice-filters" aria-label="Invoice filters">
            <select className="filter-select" aria-label="Filter by due date" value={dateRange} onChange={(event) => { setDateRange(event.target.value); setPage(1); }}><option>Last 30 days</option><option>Last 90 days</option><option>Last 6 months</option><option>Upcoming 90 days</option></select>
            <select className="filter-select" aria-label="Filter by status" value={status} onChange={(event) => { setStatus(event.target.value as InvoiceFilters["status"]); setPage(1); }}><option>All statuses</option><option>Overdue</option><option>Outstanding</option><option>Paid</option></select>
            <input className="filter-input" aria-label="Filter by customer" placeholder="Customer" value={customer} onChange={(event) => { setCustomer(event.target.value); setPage(1); }} />
            <input className="filter-input" aria-label="Filter by plan" placeholder="Plan" value={plan} onChange={(event) => { setPlan(event.target.value); setPage(1); }} />
          </div>
          <div className="table-wrap"><table><thead><tr><th>INVOICE</th><th>CUSTOMER</th><th>PLAN</th><th>DUE DATE</th><th>AMOUNT</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>
            {invoiceRows.map((invoice) => {
              const billingInvoice = isDemoMode ? billing.invoices.find((item) => item.invoiceNumber === invoice.invoiceNumber) : undefined;
              return <tr key={invoice.invoiceNumber}><td className="invoice-number">{invoice.invoiceNumber}</td><td><span className="customer-cell-avatar">{invoice.customer.slice(0, 1)}</span>{invoice.customer}</td><td>{invoice.plan}</td><td>{formatDate(invoice.dueDate)}</td><td className="amount-cell">{formatCurrency(invoice.amount)}</td><td><span className={`status-pill status-${invoice.status.toLowerCase()}`}><i /> {invoice.status}</span></td><td className="invoice-actions">
                {billingInvoice?.status === "Draft" && <><button className="text-button" onClick={() => updateInvoiceStatus(invoice.invoiceNumber, "Confirmed")}>Confirm</button><button className="text-button danger-text" onClick={() => updateInvoiceStatus(invoice.invoiceNumber, "Cancelled")}>Cancel</button></>}
                {billingInvoice?.status === "Confirmed" && <>{billingInvoice.paidAmount === 0 && <button className="text-button danger-text" onClick={() => updateInvoiceStatus(invoice.invoiceNumber, "Cancelled")}>Cancel</button>}{billingInvoice.sentAt ? <span className="sent-label">Sent</span> : <button className="text-button" onClick={() => markInvoiceSent(billingInvoice)}>Send</button>}<button className="text-button" onClick={() => printInvoice(billingInvoice)}>Print / PDF</button></>}
                {billingInvoice?.status === "Paid" && <button className="text-button" onClick={() => printInvoice(billingInvoice)}>Print / PDF</button>}
                {!billingInvoice && <span>—</span>}
              </td></tr>;
            })}
            {invoicePage && invoiceRows.length === 0 && <tr><td className="empty-row" colSpan={7}>No invoices match these filters.</td></tr>}
            {!invoicePage && <tr><td className="empty-row" colSpan={7}>Loading invoices…</td></tr>}
          </tbody></table></div>
          <div className="table-footer"><span>Showing <strong>{invoiceRows.length}</strong> of <strong>{invoicePage?.total ?? 0}</strong> matching invoices</span><div className="pagination"><button className="outline-button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {pageCount}</span><button className="outline-button" disabled={!invoicePage || page >= pageCount} onClick={() => setPage((current) => current + 1)}>Next</button></div></div>
        </section>
        <section className="renewal-callout"><span className="renewal-icon">✦</span><div><strong>Your next renewal wave is coming up</strong><span>{data.summary.upcomingRenewalCount} subscriptions renew in the next 30 days. Make sure everything is ready.</span></div></section>
        <section className="demo-guide" id="demo-guide"><span className="guide-number">01</span><div><strong>Demo guide</strong><span>Explore the finance dashboard, then switch to the customer portal to see the subscriber experience.</span></div><a href="/portal">Open customer portal <span aria-hidden="true">→</span></a></section>
      </>}
      {printedInvoice && <article className="print-invoice">
        <div className="print-brand">subloop.</div>
        <h1>Invoice {printedInvoice.invoiceNumber}</h1>
        <p>{printedInvoice.customer} · {printedInvoice.plan}</p>
        <div className="print-details">
          <span>Due date</span><strong>{formatDate(printedInvoice.dueDate)}</strong>
          <span>Status</span><strong>{getInvoiceDisplayStatus(printedInvoice, today)}</strong>
          <span>Subtotal</span><strong>{formatCurrency(printedInvoice.subtotal)}</strong>
          {printedInvoice.discounts.map((discount) => <Fragment key={discount.name}><span>Discount · {discount.name}</span><strong>−{formatCurrency(discount.amount)}</strong></Fragment>)}
          <span>Tax</span><strong>{formatCurrency(printedInvoice.taxTotal)}</strong>
          <span>Total</span><strong>{formatCurrency(printedInvoice.total)}</strong>
          <span>Paid</span><strong>{formatCurrency(printedInvoice.paidAmount)}</strong>
          <span>Balance due</span><strong>{formatCurrency(printedInvoice.total - printedInvoice.paidAmount)}</strong>
        </div>
        <p className="print-note">Demo invoice preview. No payment or tax document is issued by this prototype.</p>
      </article>}
    </AppShell>
  );
}
