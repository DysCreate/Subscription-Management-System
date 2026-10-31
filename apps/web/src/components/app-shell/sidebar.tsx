"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Repeat,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RoleGate } from "@/components/role-gate";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { NAVIGATION_GROUPS, type NavItem } from "./navigation";

export interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
  onNavigate?: () => void; // Used by mobile sheet to close on click
  isMobile?: boolean;
}

export function Sidebar({
  collapsed = false,
  onToggleCollapse,
  className,
  onNavigate,
  isMobile = false,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r bg-card/60 backdrop-blur-sm transition-all duration-300 ease-in-out",
        collapsed && !isMobile ? "w-16" : "w-64",
        className,
      )}
    >
      {/* Brand Header */}
      <div
        className={cn(
          "flex h-16 items-center border-b px-4 transition-all duration-300",
          collapsed && !isMobile ? "justify-center px-2" : "justify-between",
        )}
      >
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-3 overflow-hidden focus:outline-none"
        >
          {/* Logo icon */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/20">
            <Repeat className="h-5 w-5" />
          </div>

          {/* Logo text (hidden when collapsed) */}
          {(!collapsed || isMobile) && (
            <div className="flex flex-col text-left">
              <span className="text-base font-bold tracking-tight text-foreground">
                Sub<span className="text-indigo-600 dark:text-indigo-400">Loop</span>
              </span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Brightloop
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {NAVIGATION_GROUPS.map((grp) => {
          const groupContent = (
            <div key={grp.group} className="space-y-1">
              {(!collapsed || isMobile) && (
                <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {grp.group}
                </div>
              )}
              {collapsed && !isMobile && (
                <div className="mx-auto my-2 h-[1px] w-6 bg-border" />
              )}

              <div className="space-y-1">
                {grp.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href));

                  return (
                    <SidebarLink
                      key={item.href}
                      item={item}
                      isActive={isActive}
                      collapsed={collapsed && !isMobile}
                      onNavigate={onNavigate}
                    />
                  );
                })}
              </div>
            </div>
          );

          if (grp.adminOnly) {
            return (
              <RoleGate key={grp.group} allow={["admin"]}>
                {groupContent}
              </RoleGate>
            );
          }

          return groupContent;
        })}
      </div>

      {/* Footer Collapse Toggle (desktop only) */}
      {!isMobile && (
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className={cn(
              "w-full text-muted-foreground hover:text-foreground",
              collapsed ? "justify-center px-0" : "justify-between px-3",
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {!collapsed && (
              <span className="text-xs font-medium">Collapse sidebar</span>
            )}
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}
    </aside>
  );
}

interface SidebarLinkProps {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}

function SidebarLink({
  item,
  isActive,
  collapsed,
  onNavigate,
}: SidebarLinkProps) {
  const Icon = item.icon;

  const content = (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "group flex items-center rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
        collapsed
          ? "h-10 w-10 justify-center p-0 mx-auto"
          : "h-9 w-full px-3 py-2 gap-3",
        isActive
          ? "bg-indigo-50 text-indigo-700 shadow-sm dark:bg-indigo-950/60 dark:text-indigo-300"
          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          isActive
            ? "text-indigo-600 dark:text-indigo-400"
            : "text-muted-foreground group-hover:text-foreground",
        )}
      />
      {!collapsed && <span className="truncate">{item.title}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="font-medium text-xs">
          {item.title}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}
