"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/app-shell/sidebar";
import { TopBar } from "@/components/app-shell/top-bar";
import { ForbiddenPage } from "@/components/forbidden-page";
import { useAuth } from "@/hooks/use-auth";

const STORAGE_KEY_SIDEBAR = "subloop_sidebar_collapsed";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading, role } = useAuth();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  // Restore sidebar state from localStorage on client
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SIDEBAR);
      if (saved !== null) {
        setCollapsed(saved === "true");
      }
    } catch {
      // Ignore storage errors
    }
    setMounted(true);
  }, []);

  const handleToggleCollapse = React.useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY_SIDEBAR, String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  // Route guard: Unauthenticated -> redirect to /login
  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  // If loading auth state, show a clean loading screen
  if (isLoading || !mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <p className="text-xs text-muted-foreground animate-pulse">
            Loading SubLoop...
          </p>
        </div>
      </div>
    );
  }

  // If unauthenticated, render redirecting placeholder
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-xs text-muted-foreground">Redirecting to login...</p>
      </div>
    );
  }

  // Admin route guard: Staff opening admin-only page (/staff)
  const isAdminRoute = pathname.startsWith("/staff");
  const isForbidden = isAdminRoute && role !== "admin";

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Desktop sidebar */}
      <div className="hidden md:flex shrink-0">
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={handleToggleCollapse}
        />
      </div>

      {/* Main workspace container */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {isForbidden ? <ForbiddenPage /> : children}
        </main>
      </div>
    </div>
  );
}
