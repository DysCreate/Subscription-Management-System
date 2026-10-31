import type {
  DashboardData,
  ReportInvoice,
  PortalInvoice,
  Subscription,
} from "@/lib/types";

export const demoDashboard: DashboardData = {
  summary: {
    activeSubscriptions: 248,
    monthlyRevenue: 184250,
    outstanding: 42750,
    unpaidInvoiceCount: 34,
    overdueCount: 12,
    upcomingRenewalCount: 18,
    paymentsByMethod: [
      { method: "UPI", amount: 98200 },
      { method: "Bank transfer", amount: 54100 },
      { method: "Card", amount: 31950 },
    ],
  },
  revenue: [
    { month: "May", amount: 124000 },
    { month: "Jun", amount: 138500 },
    { month: "Jul", amount: 146200 },
    { month: "Aug", amount: 158400 },
    { month: "Sep", amount: 169800 },
    { month: "Oct", amount: 184250 },
  ],
};

export const demoInvoices: ReportInvoice[] = [
  { invoiceNumber: "INV-00241", customer: "Aster Labs", plan: "Growth", dueDate: "2026-10-12", amount: 12500, status: "Overdue" },
  { invoiceNumber: "INV-00238", customer: "Northstar Studio", plan: "Business", dueDate: "2026-10-09", amount: 9800, status: "Overdue" },
  { invoiceNumber: "INV-00231", customer: "Cedar & Co.", plan: "Starter", dueDate: "2026-10-04", amount: 7400, status: "Overdue" },
  { invoiceNumber: "INV-00225", customer: "Monsoon Systems", plan: "Growth", dueDate: "2026-09-28", amount: 13050, status: "Overdue" },
  { invoiceNumber: "INV-00223", customer: "Willow Works", plan: "Starter", dueDate: "2026-10-27", amount: 999, status: "Overdue" },
  { invoiceNumber: "INV-00220", customer: "Redwood Digital", plan: "Business", dueDate: "2026-10-25", amount: 18500, status: "Overdue" },
  { invoiceNumber: "INV-00217", customer: "Tidal Creative", plan: "Growth", dueDate: "2026-10-23", amount: 2499, status: "Overdue" },
  { invoiceNumber: "INV-00214", customer: "Summit Analytics", plan: "Business", dueDate: "2026-10-21", amount: 14900, status: "Overdue" },
  { invoiceNumber: "INV-00212", customer: "Fern & Finch", plan: "Starter", dueDate: "2026-10-19", amount: 999, status: "Overdue" },
  { invoiceNumber: "INV-00210", customer: "Copperline Tech", plan: "Growth", dueDate: "2026-10-17", amount: 2499, status: "Overdue" },
  { invoiceNumber: "INV-00207", customer: "Paper Kite Studio", plan: "Starter", dueDate: "2026-10-15", amount: 999, status: "Overdue" },
  { invoiceNumber: "INV-00203", customer: "Cloudberry Labs", plan: "Business", dueDate: "2026-10-13", amount: 18500, status: "Overdue" },
  { invoiceNumber: "INV-00254", customer: "Brightloop Studio", plan: "Growth", dueDate: "2026-11-03", amount: 2499, status: "Outstanding" },
  { invoiceNumber: "INV-00252", customer: "Harbor Design", plan: "Starter", dueDate: "2026-11-07", amount: 999, status: "Outstanding" },
  { invoiceNumber: "INV-00208", customer: "Aster Labs", plan: "Growth", dueDate: "2026-09-19", amount: 12500, status: "Paid" },
];

export const demoSubscriptions: Subscription[] = [
  { id: "SUB-000128", plan: "Growth — Monthly", amount: 2499, period: "month", status: "Active", nextBillingDate: "2026-11-12" },
  { id: "SUB-000104", plan: "Starter — Monthly", amount: 999, period: "month", status: "Active", nextBillingDate: "2026-11-18" },
  { id: "SUB-000087", plan: "Business — Annual", amount: 24999, period: "year", status: "Paused", nextBillingDate: "2027-03-01" },
];

export const demoPortalInvoices: PortalInvoice[] = [
  { id: "INV-00254", issuedAt: "2026-10-12", dueDate: "2026-10-19", amount: 2499, status: "Outstanding", description: "Growth plan · October 2026" },
  { id: "INV-00208", issuedAt: "2026-09-12", dueDate: "2026-09-19", amount: 2499, status: "Paid", description: "Growth plan · September 2026" },
  { id: "INV-00162", issuedAt: "2026-08-12", dueDate: "2026-08-19", amount: 2499, status: "Paid", description: "Growth plan · August 2026" },
];
