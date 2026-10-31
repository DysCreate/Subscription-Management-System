"use client";

import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import type { Role } from "@/types";

export interface RoleGateProps {
  /** Roles that are allowed to see the children. */
  allow: Role[];
  /** Content rendered when the user's role is included in `allow`. */
  children: React.ReactNode;
  /** Optional fallback rendered when access is denied. Defaults to nothing. */
  fallback?: React.ReactNode;
}

/**
 * Conditionally renders children based on the current user's role.
 * Admin-only actions are hidden (not just disabled) for other roles.
 *
 * Usage:
 * ```tsx
 * <RoleGate allow={["admin"]}>
 *   <Button>Delete subscription</Button>
 * </RoleGate>
 * ```
 */
export function RoleGate({ allow, children, fallback = null }: RoleGateProps) {
  const { role, isLoading } = useAuth();

  // While the user is still loading, render nothing to avoid flash.
  if (isLoading) return null;

  if (role && allow.includes(role)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
