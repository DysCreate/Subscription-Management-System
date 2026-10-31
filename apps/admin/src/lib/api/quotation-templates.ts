import type { QuotationTemplate, QuotationTemplateLine } from "@/types";
import { apiRequest } from "./client";

let templatesStore: QuotationTemplate[] = [
  {
    id: "qt_01",
    name: "Enterprise Growth & Reporting Bundle",
    description: "Full suite SaaS package with advanced analytics and dedicated cloud deployment.",
    planId: "plan_01",
    planName: "Enterprise Monthly Growth",
    validityDays: 30,
    lines: [
      {
        id: "qtl_01",
        productId: "prod_01",
        productName: "Odoo ERP Enterprise",
        variantId: "var_02",
        variantName: "Dedicated Cloud (+₹2,400)",
        quantity: 1,
        unitPrice: 14400,
        lineTotal: 14400,
        taxId: "tax_18",
      },
      {
        id: "qtl_02",
        productId: "prod_02",
        productName: "Advanced Reporting Engine",
        variantId: "var_03",
        variantName: "Excel + PowerBI (+₹650)",
        quantity: 2,
        unitPrice: 4150,
        lineTotal: 8300,
        taxId: "tax_18",
      },
    ],
    productIds: ["prod_01", "prod_02"],
    planIds: ["plan_01"],
    taxIds: ["tax_18"],
    discountIds: ["disc_festive20"],
    notes: "Includes standard deployment SLA and 30-day price guarantee.",
    createdAt: "2026-02-15T00:00:00.000Z",
    updatedAt: "2026-10-24T00:00:00.000Z",
  },
  {
    id: "qt_02",
    name: "Annual High-Capacity Commit",
    description: "Long-term annual bundle with dedicated solutions architect and priority SLA.",
    planId: "plan_02",
    planName: "Annual Commit & Save",
    validityDays: 45,
    lines: [
      {
        id: "qtl_03",
        productId: "prod_01",
        productName: "Odoo ERP Enterprise",
        variantId: "var_01",
        variantName: "Brand: Odoo (+₹560)",
        quantity: 1,
        unitPrice: 12560,
        lineTotal: 12560,
        taxId: "tax_18",
      },
      {
        id: "qtl_04",
        productId: "prod_03",
        productName: "Dedicated Solution Architect",
        quantity: 1,
        unitPrice: 35000,
        lineTotal: 35000,
        taxId: "tax_18",
      },
      {
        id: "qtl_05",
        productId: "prod_05",
        productName: "High-Throughput API Gateway",
        quantity: 2,
        unitPrice: 6000,
        lineTotal: 12000,
        taxId: "tax_12",
      },
    ],
    productIds: ["prod_01", "prod_03", "prod_05"],
    planIds: ["plan_02"],
    taxIds: ["tax_18", "tax_12"],
    discountIds: ["disc_annual10"],
    notes: "Requires minimum 12-month commitment. Quarterly reviews included.",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-10-28T00:00:00.000Z",
  },
  {
    id: "qt_03",
    name: "Seasonal Processing Burst",
    description: "Short-cycle weekly infrastructure boost with automated reporting.",
    planId: "plan_03",
    planName: "Weekly High-Compute Burst",
    validityDays: 14,
    lines: [
      {
        id: "qtl_06",
        productId: "prod_01",
        productName: "Odoo ERP Enterprise",
        quantity: 1,
        unitPrice: 12000,
        lineTotal: 12000,
        taxId: "tax_18",
      },
      {
        id: "qtl_07",
        productId: "prod_05",
        productName: "High-Throughput API Gateway",
        quantity: 1,
        unitPrice: 6000,
        lineTotal: 6000,
        taxId: "tax_12",
      },
    ],
    productIds: ["prod_01", "prod_05"],
    planIds: ["plan_03"],
    taxIds: ["tax_18", "tax_12"],
    discountIds: ["disc_flat500"],
    notes: "Auto-expires after 14 days without quotation confirmation.",
    createdAt: "2026-04-10T00:00:00.000Z",
    updatedAt: "2026-10-18T00:00:00.000Z",
  },
  {
    id: "qt_04",
    name: "Developer Sandbox & Testing Pack",
    description: "Daily staging setup for pre-production testing and integration verification.",
    planId: "plan_04",
    planName: "Daily Pay-As-You-Go Sandbox",
    validityDays: 7,
    lines: [
      {
        id: "qtl_08",
        productId: "prod_02",
        productName: "Advanced Reporting Engine",
        quantity: 1,
        unitPrice: 3500,
        lineTotal: 3500,
        taxId: "tax_05",
      },
    ],
    productIds: ["prod_02"],
    planIds: ["plan_04"],
    taxIds: ["tax_05"],
    discountIds: [],
    notes: "Daily pricing billed in arrears.",
    createdAt: "2026-05-02T00:00:00.000Z",
    updatedAt: "2026-10-30T00:00:00.000Z",
  },
];

export const MOCK_QUOTATION_TEMPLATES = templatesStore;

export interface QuotationTemplateInput {
  name: string;
  description?: string;
  planId: string;
  planName?: string;
  validityDays: number;
  lines: QuotationTemplateLine[];
  notes?: string;
}

export async function getQuotationTemplates(): Promise<QuotationTemplate[]> {
  return apiRequest<QuotationTemplate[]>("/quotation-templates", {
    mock: () => [...templatesStore],
  });
}

export async function getQuotationTemplateById(
  id: string,
): Promise<QuotationTemplate | undefined> {
  return apiRequest<QuotationTemplate | undefined>(
    `/quotation-templates/${id}`,
    {
      mock: () => templatesStore.find((template) => template.id === id),
    },
  );
}

export async function createQuotationTemplate(
  input: QuotationTemplateInput,
): Promise<QuotationTemplate> {
  return apiRequest<QuotationTemplate>("/quotation-templates", {
    method: "POST",
    mock: () => {
      const newTemplate: QuotationTemplate = {
        id: `qt_${Date.now()}`,
        name: input.name,
        description: input.description,
        planId: input.planId,
        planName: input.planName ?? "Enterprise Plan",
        validityDays: input.validityDays,
        lines: input.lines,
        productIds: Array.from(new Set(input.lines.map((l) => l.productId))),
        planIds: [input.planId],
        taxIds: Array.from(new Set(input.lines.map((l) => l.taxId).filter(Boolean) as string[])),
        discountIds: [],
        notes: input.notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      templatesStore = [newTemplate, ...templatesStore];
      return newTemplate;
    },
  });
}

export async function updateQuotationTemplate(
  id: string,
  input: Partial<QuotationTemplateInput>,
): Promise<QuotationTemplate> {
  return apiRequest<QuotationTemplate>(`/quotation-templates/${id}`, {
    method: "PUT",
    mock: () => {
      const existing = templatesStore.find((t) => t.id === id);
      if (!existing) throw new Error("Template not found");
      const lines = input.lines ?? existing.lines ?? [];
      const updated: QuotationTemplate = {
        ...existing,
        ...input,
        lines,
        productIds: Array.from(new Set(lines.map((l) => l.productId))),
        planIds: input.planId ? [input.planId] : existing.planIds,
        taxIds: Array.from(new Set(lines.map((l) => l.taxId).filter(Boolean) as string[])),
        updatedAt: new Date().toISOString(),
      };
      templatesStore = templatesStore.map((t) => (t.id === id ? updated : t));
      return updated;
    },
  });
}

export async function duplicateQuotationTemplate(
  id: string,
): Promise<QuotationTemplate> {
  return apiRequest<QuotationTemplate>(`/quotation-templates/${id}/duplicate`, {
    method: "POST",
    mock: () => {
      const source = templatesStore.find((t) => t.id === id);
      if (!source) throw new Error("Template not found");
      const clonedLines = (source.lines ?? []).map((l, index) => ({
        ...l,
        id: `qtl_${Date.now()}_${index}`,
      }));
      const duplicated: QuotationTemplate = {
        ...source,
        id: `qt_${Date.now()}`,
        name: `${source.name} (Copy)`,
        lines: clonedLines,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      templatesStore = [duplicated, ...templatesStore];
      return duplicated;
    },
  });
}

export async function deleteQuotationTemplate(id: string): Promise<void> {
  return apiRequest<void>(`/quotation-templates/${id}`, {
    method: "DELETE",
    mock: () => {
      templatesStore = templatesStore.filter((t) => t.id !== id);
    },
  });
}
