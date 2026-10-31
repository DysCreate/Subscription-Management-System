"use client";

import * as React from "react";
import { Download, FileText } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { exportReportsCsv, getNewVsChurned, getOverdueReport, getPaymentsByMethod, getReportSummary, getRevenueByMonth, getSubscriptionsByStatus } from "@/lib/api/reports";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTheme } from "next-themes";
import { toast } from "sonner";

export default function ReportsPage() {
  const [tab, setTab] = React.useState("summary");
  const [summary, setSummary] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [revenue, setRevenue] = React.useState<any[]>([]);
  const [payments, setPayments] = React.useState<any[]>([]);
  const [subs, setSubs] = React.useState<any[]>([]);
  const [nvc, setNvc] = React.useState<any[]>([]);
  const [overdue, setOverdue] = React.useState<any>({ items: [] });
  const { theme } = useTheme();
  const isDark = theme === "dark";

  React.useEffect(() => {
    const t0 = performance.now();
    Promise.all([
      getReportSummary(),
      getRevenueByMonth(),
      getPaymentsByMethod(),
      getSubscriptionsByStatus(),
      getNewVsChurned(),
      getOverdueReport({ page: 1, limit: 50 }),
    ])
      .then(([s, r, p, sb, n, o]) => {
        setSummary(s);
        setRevenue(r || []);
        setPayments(p || []);
        setSubs(sb || []);
        setNvc(n || []);
        setOverdue(o || { items: [] });
      })
      .catch(() => toast.error("Failed to load reports"))
      .finally(() => {
        setLoading(false);
        const t1 = performance.now();
        console.log(`Loaded in ${(t1-t0)/1000}s`);
      });
  }, []);

  const handleExport = async () => {
    try {
      const csv = await exportReportsCsv();
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "reports.csv";
      a.click();
      toast.success("Exported CSV");
    } catch {
      toast.error("Export failed");
    }
  };

  const overdueCols: ColumnDef<any>[] = [
    { accessorKey: "invoiceNumber", header: "Invoice" },
    { accessorKey: "customer", header: "Customer" },
    { accessorKey: "balance", header: "Balance" },
    { accessorKey: "dueDate", header: "Due Date" },
    { accessorKey: "daysLate", header: "Days Late" },
  ];

  const colors = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4"];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Business insights and analytics"
        actions={
          <Button onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-4">
              <div>Active Subscriptions: {summary?.activeSubscriptions}</div>
              <div>MRR: {summary?.mrr}</div>
              <div>ARR: {summary?.arr}</div>
              <div>Revenue Collected: {summary?.revenueCollected}</div>
              <div>Outstanding: {summary?.outstanding}</div>
              <div className="text-red-500">Overdue: {summary?.overdueCount} ({summary?.overdueAmount})</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Revenue by Month</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" stroke={isDark ? "#94a3b8" : "#64748b"} />
                  <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} />
                  <Tooltip />
                  <Line type="monotone" dataKey="revenue" stroke="#6366f1" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Subscriptions by Status</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={subs} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={100} label>
                    {subs.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>New vs Churned</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={nvc}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" stroke={isDark ? "#94a3b8" : "#64748b"} />
                  <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="new" fill="#22c55e" />
                  <Bar dataKey="churned" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue">
          <Card>
            <CardHeader><CardTitle>Revenue by Month</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" stroke={isDark ? "#94a3b8" : "#64748b"} />
                  <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} />
                  <Tooltip />
                  <Bar dataKey="revenue" fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader><CardTitle>Payments by Method</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={payments} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" stroke={isDark ? "#94a3b8" : "#64748b"} />
                  <YAxis dataKey="method" type="category" stroke={isDark ? "#94a3b8" : "#64748b"} />
                  <Tooltip />
                  <Bar dataKey="amount" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overdue">
          <Card>
            <CardHeader><CardTitle>Overdue Invoices</CardTitle></CardHeader>
            <CardContent>
              <DataTable columns={overdueCols} data={overdue.items || []} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
