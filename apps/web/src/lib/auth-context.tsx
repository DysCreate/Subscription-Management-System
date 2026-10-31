"use client";

import * as React from "react";
import type { Role, User } from "@/types";

export interface AuthContextType {
  user: User | null;
  role: Role | undefined;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  isCustomer: boolean;
  login: (email: string, password?: string, role?: Role) => Promise<void>;
  logout: () => void;
  switchRole: (role: Role) => void;
  signup: (data: { name: string; email: string; role?: Role }) => Promise<void>;
  refetch: () => void;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export const DEFAULT_MOCK_USER: User = {
  id: "usr_admin_01",
  name: "Aarav Menon",
  email: "aarav@brightloop.software",
  role: "admin",
  createdAt: "2025-08-01T00:00:00.000Z",
};

const STORAGE_KEY_USER = "subloop_auth_user";
const STORAGE_KEY_LOGGED_OUT = "subloop_logged_out";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  // Initialize auth state from localStorage on client
  React.useEffect(() => {
    try {
      const isLoggedOut = localStorage.getItem(STORAGE_KEY_LOGGED_OUT);
      if (isLoggedOut === "true") {
        setUser(null);
      } else {
        const storedUser = localStorage.getItem(STORAGE_KEY_USER);
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        } else {
          // Default to mock admin user for seamless first load
          setUser(DEFAULT_MOCK_USER);
          localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(DEFAULT_MOCK_USER));
        }
      }
    } catch {
      setUser(DEFAULT_MOCK_USER);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = React.useCallback(
    async (email: string, _password?: string, explicitRole?: Role) => {
      setIsLoading(true);
      await new Promise((res) => setTimeout(res, 350));

      let determinedRole: Role = explicitRole || "admin";
      let name = "Aarav Menon";

      if (email.toLowerCase().includes("staff") || explicitRole === "staff") {
        determinedRole = "staff";
        name = "Neha Sharma";
      } else if (email.toLowerCase().includes("admin") || explicitRole === "admin") {
        determinedRole = "admin";
        name = "Aarav Menon";
      } else if (email.includes("@")) {
        // Derive readable name from email
        const local = email.split("@")[0];
        name = local
          ? local.charAt(0).toUpperCase() + local.slice(1)
          : "SubLoop User";
      }

      const newUser: User = {
        id: `usr_${Date.now()}`,
        name,
        email,
        role: determinedRole,
        createdAt: new Date().toISOString(),
      };

      setUser(newUser);
      try {
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser));
        localStorage.removeItem(STORAGE_KEY_LOGGED_OUT);
      } catch {
        // Ignore storage errors
      }
      setIsLoading(false);
    },
    [],
  );

  const logout = React.useCallback(() => {
    setUser(null);
    try {
      localStorage.setItem(STORAGE_KEY_LOGGED_OUT, "true");
      localStorage.removeItem(STORAGE_KEY_USER);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const switchRole = React.useCallback(
    (newRole: Role) => {
      setUser((prev) => {
        if (!prev) {
          const fallback: User = {
            ...DEFAULT_MOCK_USER,
            role: newRole,
          };
          try {
            localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(fallback));
            localStorage.removeItem(STORAGE_KEY_LOGGED_OUT);
          } catch {
            // Ignore
          }
          return fallback;
        }
        const updated = { ...prev, role: newRole };
        try {
          localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updated));
        } catch {
          // Ignore
        }
        return updated;
      });
    },
    [],
  );

  const signup = React.useCallback(
    async ({
      name,
      email,
      role = "admin",
    }: {
      name: string;
      email: string;
      role?: Role;
    }) => {
      setIsLoading(true);
      await new Promise((res) => setTimeout(res, 350));
      const newUser: User = {
        id: `usr_${Date.now()}`,
        name,
        email,
        role,
        createdAt: new Date().toISOString(),
      };
      setUser(newUser);
      try {
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser));
        localStorage.removeItem(STORAGE_KEY_LOGGED_OUT);
      } catch {
        // Ignore
      }
      setIsLoading(false);
    },
    [],
  );

  const refetch = React.useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_USER);
      if (stored) setUser(JSON.parse(stored));
    } catch {
      // Ignore
    }
  }, []);

  const value: AuthContextType = {
    user,
    role: user?.role,
    isAuthenticated: Boolean(user),
    isLoading,
    isAdmin: user?.role === "admin",
    isStaff: user?.role === "staff",
    isCustomer: user?.role === "customer",
    login,
    logout,
    switchRole,
    signup,
    refetch,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextType {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
