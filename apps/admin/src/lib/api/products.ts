import type { ListQuery, Paginated, Product } from "@/types";
import { apiRequest } from "./client";

export const INITIAL_MOCK_PRODUCTS: Product[] = [
  {
    id: "prod_01",
    sku: "PROD-ODOO-001",
    name: "Odoo ERP Enterprise",
    type: "Software",
    description: "Complete business suite covering accounting, inventory, subscriptions and CRM.",
    salesPrice: 12000,
    costPrice: 4500,
    basePrice: 12000,
    isActive: true,
    createdAt: "2025-09-01T00:00:00.000Z",
    variants: [
      {
        id: "var_01",
        productId: "prod_01",
        attribute: "Brand",
        value: "Odoo",
        extraPrice: 560,
        priceDelta: 560,
      },
      {
        id: "var_02",
        productId: "prod_01",
        attribute: "Deployment",
        value: "Dedicated Cloud",
        extraPrice: 2400,
        priceDelta: 2400,
      },
    ],
  },
  {
    id: "prod_02",
    sku: "PROD-REP-002",
    name: "Advanced Reporting Engine",
    type: "Add-on",
    description: "Multi-dimensional pivot dashboards with scheduled PDF export.",
    salesPrice: 3500,
    costPrice: 800,
    basePrice: 3500,
    isActive: true,
    createdAt: "2025-09-12T00:00:00.000Z",
    variants: [
      {
        id: "var_03",
        productId: "prod_02",
        attribute: "Export Type",
        value: "Excel + PowerBI",
        extraPrice: 650,
        priceDelta: 650,
      },
    ],
  },
  {
    id: "prod_03",
    sku: "PROD-SRV-003",
    name: "Dedicated Solution Architect",
    type: "Service",
    description: "Monthly retainer for assigned senior enterprise solutions engineer.",
    salesPrice: 25000,
    costPrice: 16000,
    basePrice: 25000,
    isActive: true,
    createdAt: "2025-10-01T00:00:00.000Z",
    variants: [],
  },
  {
    id: "prod_04",
    sku: "PROD-HW-004",
    name: "POS Cryptographic Hardware Key",
    type: "Hardware",
    description: "Hardware token for local till offline sync and encryption.",
    salesPrice: 6800,
    costPrice: 5200,
    basePrice: 6800,
    isActive: false,
    createdAt: "2025-10-15T00:00:00.000Z",
    variants: [
      {
        id: "var_04",
        productId: "prod_04",
        attribute: "Interface",
        value: "USB-C Secure",
        extraPrice: 350,
        priceDelta: 350,
      },
    ],
  },
  {
    id: "prod_05",
    sku: "PROD-DUN-005",
    name: "Automated Dunning Gateway",
    type: "Add-on",
    description: "WhatsApp and SMS transactional triggers for overdue payment recovery.",
    salesPrice: 1800,
    costPrice: 450,
    basePrice: 1800,
    isActive: true,
    createdAt: "2025-10-22T00:00:00.000Z",
    variants: [],
  },
];

const STORAGE_KEY = "subloop_products_store";

export function getStoredProducts(): Product[] {
  if (typeof window === "undefined") return INITIAL_MOCK_PRODUCTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_MOCK_PRODUCTS));
      return INITIAL_MOCK_PRODUCTS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_MOCK_PRODUCTS;
  }
}

function saveProducts(products: Product[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  } catch {
    // Ignore storage issues
  }
}

export function calculateMargin(salesPrice: number, costPrice: number) {
  const marginAmount = (salesPrice || 0) - (costPrice || 0);
  const marginPercent =
    salesPrice > 0 ? (marginAmount / salesPrice) * 100 : 0;

  let tier: "high" | "moderate" | "low" = "high";
  if (marginPercent >= 30) {
    tier = "high";
  } else if (marginPercent >= 10) {
    tier = "moderate";
  } else {
    tier = "low";
  }

  return {
    marginAmount,
    marginPercent: Number(marginPercent.toFixed(1)),
    tier,
  };
}

export async function getProducts(
  params?: ListQuery,
): Promise<Paginated<Product>> {
  return apiRequest<Paginated<Product>>("/products", {
    params,
    mock: () => {
      let list = [...getStoredProducts()];

      // Filter by search
      if (params?.search) {
        const q = params.search.toLowerCase().trim();
        list = list.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.sku?.toLowerCase().includes(q) ||
            p.type.toLowerCase().includes(q),
        );
      }

      // Filter by type
      if (params?.filters?.["type"] && params.filters["type"] !== "all") {
        list = list.filter((p) => p.type === params.filters!["type"]);
      }

      // Filter by status (active / inactive)
      if (params?.filters?.["status"] && params.filters["status"] !== "all") {
        const isAct = params.filters["status"] === "active";
        list = list.filter((p) => p.isActive === isAct);
      }

      // Sort
      if (params?.sortBy) {
        const key = params.sortBy as keyof Product;
        const order = params.sortOrder === "desc" ? -1 : 1;
        list.sort((a, b) => {
          const valA = a[key] ?? "";
          const valB = b[key] ?? "";
          if (valA < valB) return -1 * order;
          if (valA > valB) return 1 * order;
          return 0;
        });
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

export async function getProductById(id: string): Promise<Product | undefined> {
  return apiRequest<Product | undefined>(`/products/${id}`, {
    mock: () => {
      const list = getStoredProducts();
      return list.find((p) => p.id === id);
    },
  });
}

export async function createProduct(
  data: Omit<Product, "id" | "createdAt">,
): Promise<Product> {
  return apiRequest<Product>("/products", {
    method: "POST",
    body: data,
    mock: () => {
      const list = getStoredProducts();
      const newProduct: Product = {
        ...data,
        id: `prod_${Date.now()}`,
        sku: data.sku || `PROD-${Date.now().toString().slice(-4)}`,
        basePrice: data.salesPrice,
        createdAt: new Date().toISOString(),
      };
      const updated = [newProduct, ...list];
      saveProducts(updated);
      return newProduct;
    },
  });
}

export async function updateProduct(
  id: string,
  data: Partial<Product>,
): Promise<Product> {
  return apiRequest<Product>(`/products/${id}`, {
    method: "PUT",
    body: data,
    mock: () => {
      const list = getStoredProducts();
      const index = list.findIndex((p) => p.id === id);
      if (index === -1) {
        throw new Error("Product not found");
      }
      const existing = list[index]!;
      const updated: Product = {
        ...existing,
        ...data,
        basePrice: data.salesPrice ?? existing.salesPrice,
      };
      list[index] = updated;
      saveProducts(list);
      return updated;
    },
  });
}

export async function deleteProduct(id: string): Promise<boolean> {
  return apiRequest<boolean>(`/products/${id}`, {
    method: "DELETE",
    mock: () => {
      const list = getStoredProducts();
      const filtered = list.filter((p) => p.id !== id);
      saveProducts(filtered);
      return true;
    },
  });
}
