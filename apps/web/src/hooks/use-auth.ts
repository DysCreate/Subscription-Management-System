"use client";

import { useAuthContext } from "@/lib/auth-context";
import type { Role, User } from "@/types";

/**
 * Auth source of truth for role-based UI and authentication status.
 * Backed by AuthProvider context with localStorage persistence and mock switching.
 */
export function useAuth() {
  const auth = useAuthContext();

  return {
    user: (auth.user ?? undefined) as User | undefined,
    role: auth.role as Role | undefined,
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    isAdmin: auth.isAdmin,
    isStaff: auth.isStaff,
    isCustomer: auth.isCustomer,
    login: auth.login,
    logout: auth.logout,
    switchRole: auth.switchRole,
    signup: auth.signup,
    error: null,
    refetch: auth.refetch,
  };
}
