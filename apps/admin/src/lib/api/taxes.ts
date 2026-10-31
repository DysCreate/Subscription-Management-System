import type { Tax, TaxStatus, TaxType } from "@/types";
import { apiRequest } from "./client";

/**
 * Tax catalogue used by subscriptions, quotations and invoices.
 * Rates mirror Indian GST slabs and fixed duties commonly applied to SaaS billing.
 */
let taxesStore: Tax[] = [
  {
    id: "tax_00",
    name: "GST Exempt (0%)",
    type: "percent",
    rate: 0,
    ratePercent: 0,
    isInclusive: false,
    status: "Active",
    createdAt: "2025-01-15T00:00:00.000Z",
  },
  {
    id: "tax_05",
    name: "GST 5%",
    type: "percent",
    rate: 5,
    ratePercent: 5,
    isInclusive: false,
    status: "Active",
    createdAt: "2025-01-15T00:00:00.000Z",
  },
  {
    id: "tax_12",
    name: "GST 12%",
    type: "percent",
    rate: 12,
    ratePercent: 12,
    isInclusive: false,
    status: "Active",
    createdAt: "2025-02-10T00:00:00.000Z",
  },
  {
    id: "tax_18",
    name: "GST 18%",
    type: "percent",
    rate: 18,
    ratePercent: 18,
    isInclusive: false,
    status: "Active",
    createdAt: "2025-02-10T00:00:00.000Z",
  },
  {
    id: "tax_28",
    name: "GST 28%",
    type: "percent",
    rate: 28,
    ratePercent: 28,
    isInclusive: false,
    status: "Active",
    createdAt: "2025-03-01T00:00:00.000Z",
  },
  {
    id: "tax_fixed_150",
    name: "Fixed Tech Surcharge",
    type: "fixed",
    rate: 150,
    ratePercent: 0,
    isInclusive: false,
    status: "Active",
    createdAt: "2025-04-12T00:00:00.000Z",
  },
  {
    id: "tax_fixed_500",
    name: "High Value Processing Duty",
    type: "fixed",
    rate: 500,
    ratePercent: 0,
    isInclusive: false,
    status: "Inactive",
    createdAt: "2025-04-18T00:00:00.000Z",
  },
];

export const MOCK_TAXES = taxesStore;

export interface TaxInput {
  name: string;
  type: TaxType;
  rate: number;
  status: TaxStatus;
  isInclusive?: boolean;
}

export async function getTaxes(): Promise<Tax[]> {
  return apiRequest<Tax[]>("/taxes", {
    mock: () => [...taxesStore],
  });
}

export async function getTaxById(id: string): Promise<Tax | undefined> {
  return apiRequest<Tax | undefined>(`/taxes/${id}`, {
    mock: () => taxesStore.find((tax) => tax.id === id),
  });
}

export async function createTax(input: TaxInput): Promise<Tax> {
  return apiRequest<Tax>("/taxes", {
    method: "POST",
    mock: () => {
      const newTax: Tax = {
        id: `tax_${Date.now()}`,
        name: input.name,
        type: input.type,
        rate: input.rate,
        ratePercent: input.type === "percent" ? input.rate : 0,
        isInclusive: input.isInclusive ?? false,
        status: input.status,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      taxesStore = [newTax, ...taxesStore];
      return newTax;
    },
  });
}

export async function updateTax(id: string, input: Partial<TaxInput>): Promise<Tax> {
  return apiRequest<Tax>(`/taxes/${id}`, {
    method: "PUT",
    mock: () => {
      const existing = taxesStore.find((t) => t.id === id);
      if (!existing) throw new Error("Tax not found");
      const updated: Tax = {
        ...existing,
        ...input,
        ratePercent: (input.type ?? existing.type) === "percent"
          ? (input.rate ?? existing.rate ?? existing.ratePercent)
          : 0,
        updatedAt: new Date().toISOString(),
      };
      taxesStore = taxesStore.map((t) => (t.id === id ? updated : t));
      return updated;
    },
  });
}

export async function deleteTax(id: string): Promise<void> {
  return apiRequest<void>(`/taxes/${id}`, {
    method: "DELETE",
    mock: () => {
      taxesStore = taxesStore.filter((t) => t.id !== id);
    },
  });
}
