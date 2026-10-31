"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Bell,
  ChevronRight,
  LogOut,
  Menu,
  Moon,
  Shield,
  Sparkles,
  Sun,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import type { Role } from "@/types";
import { getBreadcrumbFromPath } from "./navigation";
import { Sidebar } from "./sidebar";

interface MockNotification {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
}

const INITIAL_NOTIFICATIONS: MockNotification[] = [
  {
    id: "notif-1",
    title: "Invoice #INV-2025-089 paid",
    description: "₹24,900 received via UPI from TechPulse Corp.",
    time: "12m ago",
    read: false,
  },
  {
    id: "notif-2",
    title: "Subscription expiring",
    description: "Enterprise Cloud (SUB-1089) renews in 2 days.",
    time: "1h ago",
    read: false,
  },
  {
    id: "notif-3",
    title: "New customer registered",
    description: "Apex Dynamics signed up for Pro Plan.",
    time: "3h ago",
    read: false,
  },
];

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { user, role, switchRole, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState(INITIAL_NOTIFICATIONS);

  const breadcrumbs = getBreadcrumbFromPath(pathname);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success("All notifications marked as read");
  };

  const handleRoleChange = (newRole: string) => {
    const targetRole = newRole as Role;
    switchRole(targetRole);
    toast.info(`Switched role to ${targetRole.toUpperCase()} (Dev mode)`);
  };

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    router.push("/login");
  };

  // Get user initials
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "SL";

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b bg-background/95 px-4 backdrop-blur-md sm:px-6">
        {/* Left: Mobile hamburger + Breadcrumbs */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open mobile menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Breadcrumb Trail */}
          <nav
            aria-label="Breadcrumb"
            className="flex items-center space-x-1.5 text-sm text-muted-foreground"
          >
            <span className="font-medium text-muted-foreground/80">
              {breadcrumbs.group}
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
            <span className="font-semibold text-foreground">
              {breadcrumbs.item}
            </span>
          </nav>
        </div>

        {/* Right: Actions (Theme Toggle, Notifications, User Menu) */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>

          {/* Notifications Bell */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9 text-muted-foreground hover:text-foreground"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-600" />
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-80 p-0 shadow-lg">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Notifications</span>
                  {unreadCount > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                      {unreadCount} new
                    </Badge>
                  )}
                </div>
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMarkAllRead}
                    className="h-7 text-xs text-muted-foreground hover:text-foreground px-2"
                  >
                    Mark all read
                  </Button>
                )}
              </div>

              <div className="divide-y divide-border/50 max-h-80 overflow-y-auto">
                {notifications.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-1 p-3.5 text-xs hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-foreground">
                        {item.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {item.time}
                      </span>
                    </div>
                    <p className="text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-2.5 rounded-full pl-2 pr-3 py-1.5 hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring"
              >
                {/* Avatar Initials */}
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-[11px] font-bold text-white shadow-sm">
                  {initials}
                </div>

                <div className="hidden flex-col items-start text-left sm:flex">
                  <span className="text-xs font-semibold leading-none text-foreground">
                    {user?.name ?? "Aarav Menon"}
                  </span>
                </div>

                {/* Role badge */}
                <Badge
                  variant={role === "admin" ? "default" : "secondary"}
                  className="hidden text-[10px] uppercase font-semibold tracking-wider sm:inline-flex h-4 px-1.5"
                >
                  {role ?? "admin"}
                </Badge>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-64 p-2 shadow-lg">
              {/* Profile summary */}
              <div className="flex flex-col space-y-1 p-2">
                <p className="text-sm font-semibold leading-none">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.email}
                </p>
                <div className="pt-1">
                  <Badge
                    variant={role === "admin" ? "default" : "secondary"}
                    className="text-[10px] uppercase font-semibold"
                  >
                    Role: {role ?? "admin"}
                  </Badge>
                </div>
              </div>

              <DropdownMenuSeparator />

              {/* Dev Role Switcher */}
              <div className="p-1">
                <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                  <Sparkles className="h-3 w-3" />
                  <span>Dev Mode: Switch Role</span>
                </div>

                <DropdownMenuRadioGroup
                  value={role ?? "admin"}
                  onValueChange={handleRoleChange}
                >
                  <DropdownMenuRadioItem value="admin" className="cursor-pointer text-xs">
                    <Shield className="mr-2 h-3.5 w-3.5 text-indigo-500" />
                    <span>Admin (Full Access)</span>
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="staff" className="cursor-pointer text-xs">
                    <UserCheck className="mr-2 h-3.5 w-3.5 text-slate-500" />
                    <span>Staff (Restricted Access)</span>
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </div>

              <DropdownMenuSeparator />

              {/* Logout */}
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer text-xs text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <LogOut className="mr-2 h-3.5 w-3.5" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Mobile Sidebar Sheet */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-72">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation Menu</SheetTitle>
          </SheetHeader>
          <Sidebar isMobile onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
