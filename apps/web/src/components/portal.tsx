"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/app-shell";
import DemoBanner from "@/components/demo-banner";
import { demoPortalInvoices, demoSubscriptions } from "@/lib/demo-data";
import { fetchPortal, isDemoMode } from "@/lib/api";
import type { PortalInvoice, Subscription } from "@/lib/types";

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function date(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

export default function Portal() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(isDemoMode ? demoSubscriptions : []);
  const [invoices, setInvoices] = useState<PortalInvoice[]>(isDemoMode ? demoPortalInvoices : []);
  const [loading, setLoading] = useState(!isDemoMode);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"subscriptions" | "invoices">("subscriptions");
  const [notice, setNotice] = useState("");
  const [printedInvoice, setPrintedInvoice] = useState<PortalInvoice | null>(null);

  useEffect(() => {
    if (isDemoMode) return;
    fetchPortal().then((result) => {
      setSubscriptions(result.subscriptions);
      setInvoices(result.invoices);
      setLoading(false);
    }).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Could not load your account.");
      setLoading(false);
    });
  }, []);

  function showDemoNotice(action: string) {
    setNotice(`${action} isn’t available yet; no changes have been made.`);
    window.setTimeout(() => setNotice(""), 5000);
  }

  function printInvoice(invoice: PortalInvoice) {
    setPrintedInvoice(invoice);
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => setPrintedInvoice(null), 1000);
    }, 100);
  }

  return (
    <AppShell active="portal" eyebrow="YOUR ACCOUNT" title="Your account" description="Manage your subscriptions, invoices, and account details.">
      {isDemoMode && <DemoBanner />}
      {error && <div className="error-box" role="alert">Couldn’t load your account: {error}</div>}
      {notice && <div className="notice-box" role="status">{notice}</div>}
      <section className="portal-welcome">
        <div className="welcome-monogram">CU</div><div><span className="eyebrow">CUSTOMER ACCOUNT</span><h2>Your subscriptions</h2><p>Review your plans, invoices, and upcoming payments.</p></div><button className="outline-button account-button" onClick={() => showDemoNotice("Account settings")}>Account settings</button>
      </section>
      <section className="portal-summary-grid">
        <article className="portal-summary"><span>Active plans</span><strong>{subscriptions.filter((item) => item.status === "Active").length}</strong><small>Across your account</small></article>
        <article className="portal-summary"><span>Next payment</span><strong>{currency.format(subscriptions.find((item) => item.status === "Active")?.amount ?? 0)}</strong><small>{subscriptions.find((item) => item.status === "Active") ? `Due ${date(subscriptions.find((item) => item.status === "Active")!.nextBillingDate)}` : "No upcoming payments"}</small></article>
        <article className="portal-summary"><span>Amount due</span><strong>{currency.format(invoices.filter((invoice) => invoice.status !== "Paid").reduce((sum, invoice) => sum + invoice.amount, 0))}</strong><small>{invoices.filter((invoice) => invoice.status !== "Paid").length} unpaid invoice(s)</small></article>
      </section>
      <section className="panel portal-panel">
        <div className="portal-tabs" role="tablist" aria-label="Account details">
          <button role="tab" aria-selected={activeTab === "subscriptions"} className={activeTab === "subscriptions" ? "portal-tab selected" : "portal-tab"} onClick={() => setActiveTab("subscriptions")}>Subscriptions <span>{subscriptions.length}</span></button>
          <button role="tab" aria-selected={activeTab === "invoices"} className={activeTab === "invoices" ? "portal-tab selected" : "portal-tab"} onClick={() => setActiveTab("invoices")}>Invoices <span>{invoices.length}</span></button>
        </div>
        {loading ? <div className="empty-state">Loading your account…</div> : activeTab === "subscriptions" ? <div className="subscription-list">
          {subscriptions.map((subscription) => <article className="subscription-item" key={subscription.id}>
            <div className="plan-icon">▧</div><div className="subscription-main"><div className="subscription-title">{subscription.plan}<span className={`status-pill ${subscription.status === "Active" ? "status-paid" : subscription.status === "Paused" ? "status-neutral" : "status-pending"}`}><i />{subscription.status}</span></div><span className="subscription-id">{subscription.id} &nbsp;·&nbsp; Renews {date(subscription.nextBillingDate)}</span></div>
            <div className="subscription-price"><strong>{currency.format(subscription.amount)}</strong><span>/ {subscription.period}</span></div>
            <button className="outline-button subscription-action" onClick={() => showDemoNotice(subscription.status === "Paused" ? "Resume request" : "Subscription request")}>{subscription.status === "Paused" ? "Request resume" : "Manage"}</button>
          </article>)}
          {subscriptions.length === 0 && <div className="empty-state">No subscriptions were found for your account.</div>}
        </div> : <div className="table-wrap"><table><thead><tr><th>INVOICE</th><th>DESCRIPTION</th><th>ISSUED</th><th>DUE DATE</th><th>AMOUNT</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>
          {invoices.map((invoice) => <tr key={invoice.id}><td className="invoice-number">{invoice.id}</td><td>{invoice.description}</td><td>{date(invoice.issuedAt)}</td><td>{date(invoice.dueDate)}</td><td className="amount-cell">{currency.format(invoice.amount)}</td><td><span className={`status-pill ${invoice.status === "Paid" ? "status-paid" : invoice.status === "Overdue" ? "status-overdue" : "status-pending"}`}><i />{invoice.status}</span></td><td><button className="text-button" onClick={() => printInvoice(invoice)}>Print / PDF</button></td></tr>)}
          {invoices.length === 0 && <tr><td className="empty-row" colSpan={7}>No invoices were found for your account.</td></tr>}
        </tbody></table></div>}
      </section>
      <section className="portal-help"><span className="help-icon">?</span><div><strong>Need help with your subscription?</strong><span>Our team is here to help with billing or plan changes.</span></div><button className="text-button" onClick={() => showDemoNotice("Support request")}>Contact support <span aria-hidden="true">→</span></button></section>
      {printedInvoice && <article className="print-invoice">
        <div className="print-brand">subloop.</div>
        <h1>Invoice {printedInvoice.id}</h1>
        <p>{printedInvoice.description}</p>
        <div className="print-details"><span>Issued</span><strong>{date(printedInvoice.issuedAt)}</strong><span>Due date</span><strong>{date(printedInvoice.dueDate)}</strong><span>Status</span><strong>{printedInvoice.status}</strong><span>Total due</span><strong>{currency.format(printedInvoice.amount)}</strong></div>
        <p className="print-note">This document is a customer portal preview. Contact your account team for an official tax invoice.</p>
      </article>}
    </AppShell>
  );
}
