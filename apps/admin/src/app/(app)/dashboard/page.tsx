"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, Plus, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { getReportSummary, getRevenueByMonth, getSubscriptionsByStatus, getPaymentsByMethod, getNewVsChurned, getOverdueReport, getRenewalsUpcoming } from "@/lib/api/reports";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTheme } from "next-themes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function StatCard({ title, value, delta, red }: { title: string; value: string | number; delta?: number; red?: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${red ? "text-red-500" : ""}`}>{value}</div>
        {delta !== undefined && <p className="text-xs text-muted-foreground">Δ {delta > 0 ? "+" : ""}{delta}% vs prev</p>}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [range, setRange] = React.useState("this_month");
  const [loading, setLoading] = React.useState(true);
  const [summary, setSummary] = React.useState<any>(null);
  const [revenue, setRevenue] = React.useState<any[]>([]);
  const [subs, setSubs] = React.useState<any[]>([]);
  const [payments, setPayments] = React.useState<any[]>([]);
  const [nvc, setNvc] = React.useState<any[]>([]);
  const [overdue, setOverdue] = React.useState<any>({ items: [] });
  const [renewals, setRenewals] = React.useState<any[]>([]);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [loadTime, setLoadTime] = React.useState<number>(0);

  React.useEffect(() => {
    const t0 = performance.now();
    setLoading(true);
    Promise.all([
      getReportSummary(),
      getRevenueByMonth(),
      getSubscriptionsByStatus(),
      getPaymentsByMethod(),
      getNewVsChurned(),
      getOverdueReport({ page: 1, limit: 5 }),
      getRenewalsUpcoming(),
    ])
      .then(([s, r, sb, p, n, o, ren]) => {
        setSummary(s);
        setRevenue(r || []);
        setSubs(sb || []);
        setPayments(p || []);
        setNvc(n || []);
        setOverdue(o || { items: [] });
        setRenewals(ren || []);
      })
      .catch(() => toast.error("Failed to load dashboard"))
      .finally(() => {
        setLoading(false);
        const t1 = performance.now();
        setLoadTime((t1 - t0) / 1000);
      });
  }, [range]);

  const colors = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4"];

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Real-time recurring revenue metrics" />
        <div className="grid gap-4 md:grid-cols-6">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Real-time recurring revenue metrics, subscription counts and active billing cycles."
        actions={
          <div className="flex items-center gap-2">
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month">This month</SelectItem>
                <SelectItem value="last_month">Last month</SelectItem>
                <SelectItem value="last_90">Last 90 days</SelectItem>
                <SelectItem value="this_year">This year</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            <Button
              className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => router.push("/subscriptions/new")}
            >
              <Plus className="h-4 w-4" />
              New Subscription
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-6">
        <StatCard title="Active subscriptions" value={summary?.activeSubscriptions ?? 0} delta={summary?.delta?.activeSubscriptions} />
        <StatCard title="MRR" value={`₹${(summary?.mrr ?? 0).toLocaleString()}`} delta={summary?.delta?.mrr} />
        <StatCard title="ARR" value={`₹${(summary?.arr ?? 0).toLocaleString()}`} delta={summary?.delta?.arr} />
        <StatCard title="Revenue collected" value={`₹${(summary?.revenueCollected ?? 0).toLocaleString()}`} delta={summary?.delta?.revenueCollected} />
        <StatCard title="Outstanding" value={`₹${(summary?.outstanding ?? 0).toLocaleString()}`} delta={summary?.delta?.outstanding} />
        <StatCard title="Overdue" value={`${summary?.overdueCount ?? 0} (₹${(summary?.overdueAmount ?? 0).toLocaleString()})`} red delta={summary?.delta?.overdueCount} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Revenue by month</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenue}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" stroke={isDark ? "#94a3b8" : "#64748b"} />
                <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Subscriptions by status</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={subs} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} label>
                  {subs.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Payments by method</CardTitle></CardHeader>
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

        <Card>
          <CardHeader><CardTitle>New vs churned</CardTitle></CardHeader>
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
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>Overdue invoices (top 5)</CardTitle></CardHeader>
          <CardContent>
            {(overdue.items || []).length === 0 ? (
              <div className="text-sm text-muted-foreground">No overdue invoices</div>
            ) : (
              <div className="space-y-2">
                {overdue.items.slice(0, 5).map((inv: any) => (
                  <div key={inv.id} className="flex items-center justify-between border-b pb-2">
                    <div>
                      <div className="font-medium">{inv.invoiceNumber}</div>
                      <div className="text-sm text-muted-foreground">{inv.customer} • {inv.daysLate} days late</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-red-500">₹{inv.balance?.toLocaleString()}</div>
                      <Button size="sm" variant="outline" onClick={() => toast.info("Reminder sent (stub)")}>Send reminder</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Upcoming renewals (next 30 days)</CardTitle></CardHeader>
          <CardContent>
            {(renewals || []).length === 0 ? (
              <div className="text-sm text-muted-foreground">None</div>
            ) : (
              <div className="space-y-2">
                {renewals.slice(0, 10).map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between border-b pb-2">
                    <div>
                      <div className="font-medium">{r.subscriptionNumber}</div>
                      <div className="text-sm text-muted-foreground">{r.customer}</div>
                    </div>
                    <div className="text-sm">{r.nextBillingDate ? new Date(r.nextBillingDate).toLocaleDateString() : "-"}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="text-xs text-muted-foreground text-right">Loaded in {loadTime.toFixed(2)} s</div>
    </div>
  );
}
