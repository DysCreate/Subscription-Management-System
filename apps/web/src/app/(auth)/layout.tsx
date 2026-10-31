"use client";

import * as React from "react";
import Link from "next/link";
import { Repeat, ShieldCheck, TrendingUp, Sparkles } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row bg-background">
      {/* Left: Indigo-Violet Gradient Brand Panel */}
      <div className="relative hidden w-full lg:flex lg:w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-950 p-10 xl:p-14 text-white">
        {/* Subtle decorative background glow effects */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-violet-500/25 blur-3xl" />

        {/* Top brand header */}
        <div className="relative z-10">
          <Link href="/login" className="inline-flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-400 text-white shadow-lg shadow-indigo-500/30">
              <Repeat className="h-6 w-6 stroke-[2.5]" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-white">
                Sub<span className="text-indigo-400">Loop</span>
              </span>
              <span className="text-[10px] uppercase tracking-wider text-indigo-200/80 font-medium">
                Brightloop Software
              </span>
            </div>
          </Link>
        </div>

        {/* Center hero message & metrics */}
        <div className="relative z-10 my-auto py-12 max-w-lg space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3.5 py-1 text-xs font-medium text-indigo-200 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
            <span>Next-Gen Subscription OS</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl xl:text-5xl text-balance leading-tight">
              Recurring revenue,{" "}
              <span className="bg-gradient-to-r from-indigo-200 via-indigo-100 to-violet-200 bg-clip-text text-transparent">
                on autopilot.
              </span>
            </h1>
            <p className="text-sm sm:text-base text-indigo-100/80 text-pretty leading-relaxed">
              Unify plans, automated recurring invoicing, UPI & card collections,
              and customer lifecycle operations in a single, high-performance workspace.
            </p>
          </div>

          {/* Social Proof / Metrics Card */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md space-y-4 shadow-xl shadow-black/20">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-200">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                <span>Real-time Billing Health</span>
              </div>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                +24.8% MoM
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 text-left">
              <div>
                <p className="text-[11px] text-indigo-200/70">Monthly MRR</p>
                <p className="text-lg font-bold text-white tracking-tight">₹14.8 Lakh</p>
              </div>
              <div>
                <p className="text-[11px] text-indigo-200/70">Collection Rate</p>
                <p className="text-lg font-bold text-emerald-400 tracking-tight">99.4%</p>
              </div>
              <div>
                <p className="text-[11px] text-indigo-200/70">Active Subs</p>
                <p className="text-lg font-bold text-white tracking-tight">1,240+</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between text-xs text-indigo-200/60 border-t border-white/10 pt-4">
          <p>© 2026 Brightloop Software Inc.</p>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-300" />
            <span>Bank-grade security</span>
          </div>
        </div>
      </div>

      {/* Right: Form Card Area */}
      <div className="flex w-full lg:w-1/2 flex-1 flex-col justify-center items-center p-6 sm:p-10 lg:p-12 xl:p-16">
        {/* Mobile brand header (visible on smaller screens) */}
        <div className="mb-6 flex lg:hidden items-center justify-center">
          <Link href="/login" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-md">
              <Repeat className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              Sub<span className="text-indigo-600">Loop</span>
            </span>
          </Link>
        </div>

        {/* Form Container */}
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
}
