import type { Discount, DiscountScope, DiscountStatus, DiscountType } from "@/types";
import { apiRequest } from "./client";

export function computeDiscountStatus(discount: Discount, now: Date = new Date()): DiscountStatus {
  const todayStr = now.toISOString().slice(0, 10);
  if (discount.maxUses != null && (discount.usedCount ?? 0) >= discount.maxUses) {
    return "Exhausted";
  }
  if (!discount.isActive) {
    return "Expired";
  }
  if (discount.validTo && discount.validTo < todayStr) {
    return "Expired";
  }
  if (discount.validFrom && discount.validFrom > todayStr) {
    return "Scheduled";
  }
  return "Active";
}

let discountsStore: Discount[] = [
  {
    id: "disc_festive20",
    code: "FESTIVE20",
    name: "Festive Season 20% Off",
    type: "percent",
    value: 20,
    scope: "Subscription",
    minPurchaseAmount: 3000,
    minQuantity: 1,
    validFrom: "2026-01-01",
    validTo: "2027-03-31",
    maxUses: 250,
    usedCount: 165,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "disc_annual10",
    code: "ANNUAL10",
    name: "Annual Prepay Reward",
    type: "percent",
    value: 10,
    scope: "Subscription",
    minPurchaseAmount: 10000,
    minQuantity: 1,
    validFrom: "2026-04-01",
    validTo: "2027-03-31",
    maxUses: 150,
    usedCount: 42,
    isActive: true,
    createdAt: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "disc_flat500",
    code: "FLAT500",
    name: "Quick Startup Voucher",
    type: "fixed",
    value: 500,
    scope: "Product",
    productIds: ["prod_01", "prod_02"],
    minPurchaseAmount: 2000,
    minQuantity: 1,
    validFrom: "2026-06-01",
    validTo: "2027-01-31",
    maxUses: 100,
    usedCount: 28,
    isActive: true,
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "disc_ent_boost",
    code: "ENTBOOST",
    name: "Enterprise SLA Booster ₹2,500 Off",
    type: "fixed",
    value: 2500,
    scope: "Product",
    productIds: ["prod_03", "prod_05"],
    minPurchaseAmount: 15000,
    minQuantity: 2,
    validFrom: "2026-11-15",
    validTo: "2027-05-30",
    maxUses: 80,
    usedCount: 0,
    isActive: true,
    createdAt: "2026-10-01T00:00:00.000Z",
  },
  {
    id: "disc_exhausted",
    code: "EARLYVIP",
    name: "Early Bird VIP Tier",
    type: "percent",
    value: 30,
    scope: "Subscription",
    minPurchaseAmount: 5000,
    minQuantity: 1,
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
    maxUses: 50,
    usedCount: 50,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "disc_expired",
    code: "SUMMER25",
    name: "Summer Launch Promo",
    type: "percent",
    value: 25,
    scope: "Subscription",
    minPurchaseAmount: 2500,
    minQuantity: 1,
    validFrom: "2025-04-01",
    validTo: "2025-08-31",
    maxUses: 200,
    usedCount: 198,
    isActive: false,
    createdAt: "2025-04-01T00:00:00.000Z",
  },
];

export const MOCK_DISCOUNTS = discountsStore;

export interface DiscountInput {
  name: string;
  code: string;
  type: DiscountType;
  value: number;
  scope: DiscountScope;
  productIds?: string[];
  minPurchaseAmount?: number;
  minQuantity?: number;
  validFrom: string;
  validTo: string;
  maxUses: number;
}

export async function getDiscounts(): Promise<Discount[]> {
  return apiRequest<Discount[]>("/discounts", {
    mock: () => {
      return discountsStore.map((d) => ({
        ...d,
        status: computeDiscountStatus(d),
      }));
    },
  });
}

export async function getDiscountById(id: string): Promise<Discount | undefined> {
  return apiRequest<Discount | undefined>(`/discounts/${id}`, {
    mock: () => {
      const found = discountsStore.find((d) => d.id === id);
      if (!found) return undefined;
      return {
        ...found,
        status: computeDiscountStatus(found),
      };
    },
  });
}

export async function createDiscount(input: DiscountInput): Promise<Discount> {
  return apiRequest<Discount>("/discounts", {
    method: "POST",
    mock: () => {
      const newDiscount: Discount = {
        id: `disc_${Date.now()}`,
        name: input.name,
        code: input.code.toUpperCase().trim(),
        type: input.type,
        value: input.value,
        scope: input.scope,
        productIds: input.scope === "Product" ? input.productIds ?? [] : [],
        minPurchaseAmount: input.minPurchaseAmount,
        minQuantity: input.minQuantity,
        validFrom: input.validFrom,
        validTo: input.validTo,
        maxUses: input.maxUses,
        usedCount: 0,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      discountsStore = [newDiscount, ...discountsStore];
      return {
        ...newDiscount,
        status: computeDiscountStatus(newDiscount),
      };
    },
  });
}

export async function updateDiscount(id: string, input: Partial<DiscountInput>): Promise<Discount> {
  return apiRequest<Discount>(`/discounts/${id}`, {
    method: "PUT",
    mock: () => {
      const existing = discountsStore.find((d) => d.id === id);
      if (!existing) throw new Error("Discount not found");
      const updated: Discount = {
        ...existing,
        ...input,
        code: input.code ? input.code.toUpperCase().trim() : existing.code,
        productIds: (input.scope ?? existing.scope) === "Product"
          ? (input.productIds ?? existing.productIds ?? [])
          : [],
        updatedAt: new Date().toISOString(),
      };
      discountsStore = discountsStore.map((d) => (d.id === id ? updated : d));
      return {
        ...updated,
        status: computeDiscountStatus(updated),
      };
    },
  });
}

export async function deleteDiscount(id: string): Promise<void> {
  return apiRequest<void>(`/discounts/${id}`, {
    method: "DELETE",
    mock: () => {
      discountsStore = discountsStore.filter((d) => d.id !== id);
    },
  });
}

/**
 * Picks the best currently valid discount for a new subscription.
 * Exhausted, expired and inactive promotions are ignored.
 */
export function findApplicableDiscount(
  discounts: Discount[],
  now: Date = new Date(),
): Discount | undefined {
  const eligible = discounts.filter((d) => computeDiscountStatus(d, now) === "Active");

  // Prefer percentage promotions, then the highest value.
  return eligible.sort((a, b) => {
    if (a.type !== b.type) return a.type === "percent" ? -1 : 1;
    return b.value - a.value;
  })[0];
}
