import { addDays, addWeeks, addMonths, addYears, isAfter, isBefore, startOfDay } from "date-fns";
import type { BillingPeriod, ListQuery, Paginated, Plan, PlanStatus } from "@/types";
import { apiRequest } from "./client";

export const INITIAL_MOCK_PLANS: Plan[] = [
  {
    id: "plan_01",
    name: "Enterprise Monthly Growth",
    description: "Standard monthly billing for growing businesses with unlimited user accounts.",
    billingPeriod: "monthly",
    price: 12000,
    minQuantity: 1,
    availableFrom: "2025-01-01",
    availableTo: "2026-12-31",
    autoClose: false,
    closable: true,
    pausable: true,
    renewable: true,
    trialDays: 14,
    isActive: true,
    createdAt: "2025-08-15T00:00:00.000Z",
  },
  {
    id: "plan_02",
    name: "Annual Commit & Save",
    description: "Annualized prepaid plan with discounted software licensing and priority SLA.",
    billingPeriod: "yearly",
    price: 115000,
    minQuantity: 1,
    availableFrom: "2025-01-01",
    availableTo: "2027-12-31",
    autoClose: false,
    closable: false,
    pausable: false,
    renewable: true,
    trialDays: 0,
    isActive: true,
    createdAt: "2025-08-20T00:00:00.000Z",
  },
  {
    id: "plan_03",
    name: "Weekly High-Compute Burst",
    description: "Weekly rolling burst server capacity for seasonal processing spikes.",
    billingPeriod: "weekly",
    price: 2800,
    minQuantity: 2,
    availableFrom: "2025-06-01",
    availableTo: "2026-06-30",
    autoClose: true,
    closable: true,
    pausable: true,
    renewable: false,
    trialDays: 3,
    isActive: true,
    createdAt: "2025-09-05T00:00:00.000Z",
  },
  {
    id: "plan_04",
    name: "Daily Pay-As-You-Go Sandbox",
    description: "Daily micro-billing environment for development instances and staging tests.",
    billingPeriod: "daily",
    price: 450,
    minQuantity: 1,
    availableFrom: "2025-01-01",
    availableTo: "2026-12-31",
    autoClose: true,
    closable: true,
    pausable: true,
    renewable: true,
    trialDays: 1,
    isActive: true,
    createdAt: "2025-09-20T00:00:00.000Z",
  },
  {
    id: "plan_05",
    name: "Legacy Special 2025 Promo",
    description: "Promotional bundle offered exclusively during Q1 2025.",
    billingPeriod: "monthly",
    price: 7999,
    minQuantity: 1,
    availableFrom: "2025-01-01",
    availableTo: "2025-03-31",
    autoClose: true,
    closable: true,
    pausable: false,
    renewable: false,
    trialDays: 0,
    isActive: false,
    createdAt: "2025-01-01T00:00:00.000Z",
  },
];

const STORAGE_KEY = "subloop_plans_store";

export function getStoredPlans(): Plan[] {
  if (typeof window === "undefined") return INITIAL_MOCK_PLANS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_MOCK_PLANS));
      return INITIAL_MOCK_PLANS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_MOCK_PLANS;
  }
}

function savePlans(plans: Plan[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  } catch {
    // Ignore storage issues
  }
}

export function computePlanStatus(
  availableFrom?: string,
  availableTo?: string,
): PlanStatus {
  const today = startOfDay(new Date());

  if (availableFrom) {
    const fromDate = startOfDay(new Date(availableFrom));
    if (isBefore(today, fromDate)) {
      return "scheduled";
    }
  }

  if (availableTo) {
    const toDate = startOfDay(new Date(availableTo));
    if (isAfter(today, toDate)) {
      return "expired";
    }
  }

  return "available";
}

export function calculateNextInvoiceDates(
  billingPeriod: BillingPeriod,
  startDate?: string | Date,
  count = 3,
): Date[] {
  let baseDate = startDate ? new Date(startDate) : new Date();
  if (Number.isNaN(baseDate.getTime())) baseDate = new Date();

  // If start date is in the past, calculate from today
  if (isBefore(baseDate, new Date())) {
    baseDate = new Date();
  }

  const dates: Date[] = [];
  let current = baseDate;

  for (let i = 0; i < count; i++) {
    switch (billingPeriod) {
      case "daily":
        current = addDays(current, 1);
        break;
      case "weekly":
        current = addWeeks(current, 1);
        break;
      case "monthly":
        current = addMonths(current, 1);
        break;
      case "yearly":
        current = addYears(current, 1);
        break;
    }
    dates.push(new Date(current));
  }

  return dates;
}

export function calculateAnnualizedAmount(
  price: number,
  billingPeriod: BillingPeriod,
): number {
  const num = price || 0;
  switch (billingPeriod) {
    case "daily":
      return num * 365;
    case "weekly":
      return num * 52;
    case "monthly":
      return num * 12;
    case "yearly":
      return num;
  }
}

export async function getPlans(
  params?: ListQuery,
): Promise<Paginated<Plan>> {
  return apiRequest<Paginated<Plan>>("/plans", {
    params,
    mock: () => {
      let list = [...getStoredPlans()];

      // Filter by search
      if (params?.search) {
        const q = params.search.toLowerCase().trim();
        list = list.filter((p) => p.name.toLowerCase().includes(q));
      }

      // Filter by billing period
      if (
        params?.filters?.["billingPeriod"] &&
        params.filters["billingPeriod"] !== "all"
      ) {
        list = list.filter(
          (p) => p.billingPeriod === params.filters!["billingPeriod"],
        );
      }

      // Filter by computed status
      if (params?.filters?.["status"] && params.filters["status"] !== "all") {
        list = list.filter(
          (p) =>
            computePlanStatus(p.availableFrom, p.availableTo) ===
            params.filters!["status"],
        );
      }

      const total = list.length;
      const page = params?.page ?? 1;
      const pageSize = params?.pageSize ?? 10;
      const start = (page - 1) * pageSize;
      const paginatedItems = list.slice(start, start + pageSize);

      return {
        items: paginatedItems,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
      };
    },
  });
}

export async function getPlanById(id: string): Promise<Plan | undefined> {
  return apiRequest<Plan | undefined>(`/plans/${id}`, {
    mock: () => {
      const list = getStoredPlans();
      return list.find((p) => p.id === id);
    },
  });
}

export async function createPlan(
  data: Omit<Plan, "id" | "createdAt">,
): Promise<Plan> {
  return apiRequest<Plan>("/plans", {
    method: "POST",
    body: data,
    mock: () => {
      const list = getStoredPlans();
      const newPlan: Plan = {
        ...data,
        id: `plan_${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      const updated = [newPlan, ...list];
      savePlans(updated);
      return newPlan;
    },
  });
}

export async function updatePlan(
  id: string,
  data: Partial<Plan>,
): Promise<Plan> {
  return apiRequest<Plan>(`/plans/${id}`, {
    method: "PUT",
    body: data,
    mock: () => {
      const list = getStoredPlans();
      const index = list.findIndex((p) => p.id === id);
      if (index === -1) {
        throw new Error("Plan not found");
      }
      const existing = list[index]!;
      const updated: Plan = {
        ...existing,
        ...data,
      };
      list[index] = updated;
      savePlans(list);
      return updated;
    },
  });
}

export async function deletePlan(id: string): Promise<boolean> {
  return apiRequest<boolean>(`/plans/${id}`, {
    method: "DELETE",
    mock: () => {
      const list = getStoredPlans();
      const filtered = list.filter((p) => p.id !== id);
      savePlans(filtered);
      return true;
    },
  });
}
