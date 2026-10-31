import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  startOfDay,
} from "date-fns";
import type {
  Discount,
  ListQuery,
  Paginated,
  PaymentTerms,
  Plan,
  Product,
  Subscription,
  SubscriptionLine,
  SubscriptionStatus,
} from "@/types";
import { apiRequest } from "./client";
import { getStoredCustomers } from "./customers";
import { MOCK_DISCOUNTS } from "./discounts";
import { getStoredPlans } from "./plans";
import { getStoredProducts } from "./products";
import { MOCK_TAXES } from "./taxes";

export type SubscriptionListResult = Paginated<Subscription> & {
  /** Counts for every tab, computed after search/filters but before the status filter. */
  statusCounts: Record<SubscriptionStatus, number>;
};

/** Status keys used by the subscription list tabs (paused is not a top-level tab). */
export type SubscriptionTabStatus =
  | "all"
  | "draft"
  | "quotation"
  | "confirmed"
  | "active"
  | "closed";

const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  "draft",
  "quotation",
  "confirmed",
  "active",
  "closed",
];

function createStatusSequence(): SubscriptionStatus[] {
  // Fixed distribution across all lifecycle statuses: 8 + 10 + 8 + 26 + 8 = 60.
  const counts: Record<Exclude<SubscriptionStatus, "paused">, number> = {
    draft: 8,
    quotation: 10,
    confirmed: 8,
    active: 26,
    closed: 8,
  };

  const sequence: SubscriptionStatus[] = [];
  (Object.keys(counts) as Array<Exclude<SubscriptionStatus, "paused">>).forEach(
    (status) => {
      for (let i = 0; i < counts[status]; i += 1) sequence.push(status);
    },
  );

  // Deterministic shuffle so statuses are interleaved in the table.
  for (let i = sequence.length - 1; i > 0; i -= 1) {
    const j = (i * 37 + 11) % (i + 1);
    const current = sequence[i]!;
    sequence[i] = sequence[j]!;
    sequence[j] = current;
  }

  return sequence;
}

interface PackageDefinition {
  productId: string;
  variantId?: string;
  planId: string;
  quantity: number;
  taxRatePercent: number;
}

const PACKAGES: PackageDefinition[] = [
  { productId: "prod_01", variantId: "var_01", planId: "plan_01", quantity: 1, taxRatePercent: 18 },
  { productId: "prod_02", variantId: "var_03", planId: "plan_01", quantity: 2, taxRatePercent: 18 },
  { productId: "prod_03", planId: "plan_02", quantity: 1, taxRatePercent: 18 },
  { productId: "prod_01", variantId: "var_02", planId: "plan_03", quantity: 3, taxRatePercent: 12 },
  { productId: "prod_05", planId: "plan_04", quantity: 2, taxRatePercent: 5 },
  { productId: "prod_04", variantId: "var_04", planId: "plan_01", quantity: 1, taxRatePercent: 28 },
  { productId: "prod_01", planId: "plan_02", quantity: 1, taxRatePercent: 18 },
  { productId: "prod_02", planId: "plan_03", quantity: 4, taxRatePercent: 12 },
];

const PAYMENT_TERMS: PaymentTerms[] = ["immediate", "net_15", "net_30", "net_60"];

const MOCK_NOW = new Date();

function priceForPackage(pkg: PackageDefinition): number {
  const plans = getStoredPlans();
  const products = getStoredProducts();
  const plan = plans.find((item) => item.id === pkg.planId);
  const product = products.find((item) => item.id === pkg.productId);
  const variant = product?.variants.find((item) => item.id === pkg.variantId);
  return (plan?.price ?? product?.salesPrice ?? 0) + (variant?.extraPrice ?? 0);
}

function discountForIndex(index: number): Discount | undefined {
  if (index % 5 !== 0 && index % 7 !== 0) return undefined;
  const active = MOCK_DISCOUNTS.filter((discount) => discount.isActive);
  return active[index % active.length];
}

function buildSubscription(index: number, status: SubscriptionStatus): Subscription {
  const start = startOfDay(MOCK_NOW);
  const pkg = PACKAGES[index % PACKAGES.length]!;
  const plan = getStoredPlans().find((item) => item.id === pkg.planId);
  const termMonths = plan?.billingPeriod === "yearly" ? 12 : 12;

  let startDate: Date;
  if (status === "draft") {
    startDate = addDays(start, 5 + (index % 21));
  } else if (status === "quotation") {
    startDate = addDays(start, 1 + (index % 14));
  } else if (status === "confirmed") {
    startDate = addDays(start, -2 + (index % 5));
  } else if (status === "active") {
    startDate = addDays(start, -(30 + (index % 240)));
  } else {
    startDate = addDays(start, -(420 + (index % 260)));
  }

  const endDate = addMonths(startDate, termMonths);
  const lineCount = 1 + (index % 3 === 0 ? 1 : 0);
  const lines: SubscriptionLine[] = [];

  for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
    const linePkg = PACKAGES[(index + lineIndex) % PACKAGES.length]!;
    const linePlan = getStoredPlans().find((item) => item.id === linePkg.planId);
    const linePrice = priceForPackage(linePkg);
    lines.push({
      id: `subline_${index}_${lineIndex}`,
      subscriptionId: `sub_${index}`,
      productId: linePkg.productId,
      variantId: linePkg.variantId,
      planId: linePkg.planId,
      quantity: Math.max(linePkg.quantity, linePlan?.minQuantity ?? 1),
      unitPrice: linePrice,
      discountValue: 0,
      taxRatePercent: linePkg.taxRatePercent,
    });
  }

  const subtotal = lines.reduce(
    (sum, line) => sum + line.quantity * line.unitPrice,
    0,
  );
  const discount = discountForIndex(index);
  const discountTotal = discount
    ? discount.type === "percent"
      ? Math.round(subtotal * (discount.value / 100) * 100) / 100
      : Math.min(discount.value, subtotal)
    : 0;
  const taxable = Math.max(subtotal - discountTotal, 0);
  const effectiveTaxRate =
    lines.reduce((sum, line) => sum + line.taxRatePercent, 0) / lines.length;
  const taxTotal = Math.round(taxable * (effectiveTaxRate / 100) * 100) / 100;
  const total = Math.round((taxable + taxTotal) * 100) / 100;

  const billingPeriod = plan?.billingPeriod ?? "monthly";
  const today = startOfDay(MOCK_NOW);
  const nextBillingDate =
    status === "confirmed" || status === "active"
      ? billingPeriod === "daily"
        ? addDays(today, 1)
        : billingPeriod === "weekly"
          ? addDays(today, 3 + (index % 5))
          : billingPeriod === "yearly"
            ? addMonths(today, 1 + (index % 10))
            : addDays(today, 3 + (index % 24))
      : undefined;

  const createdAt = addDays(startDate, -3 - (index % 5));

  return {
    id: `sub_${String(index + 1).padStart(3, "0")}`,
    subscriptionNumber: `SUB-${String(101 + index).padStart(6, "0")}`,
    customerId: `cust_${String((index % 24) + 1).padStart(2, "0")}`,
    quotationTemplateId:
      index % 4 === 0 ? `qt_${["starter", "enterprise", "burst", "retail"][index % 4]}` : undefined,
    status,
    lines,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    nextBillingDate: nextBillingDate?.toISOString(),
    paymentTerms: PAYMENT_TERMS[index % PAYMENT_TERMS.length],
    closedAt: status === "closed" ? addDays(endDate, -1).toISOString() : undefined,
    createdAt: createdAt.toISOString(),
    discountId: discount?.id,
    subtotal,
    discountTotal,
    taxTotal,
    total,
  };
}

function generateMockSubscriptions(): Subscription[] {
  return createStatusSequence().map((status, index) =>
    buildSubscription(index, status),
  );
}

const STORAGE_KEY = "subloop_subscriptions_store_v1";

export function getStoredSubscriptions(): Subscription[] {
  if (typeof window === "undefined") return generateMockSubscriptions();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const generated = generateMockSubscriptions();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(generated));
      return generated;
    }
    const parsed = JSON.parse(raw) as Subscription[];
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : generateMockSubscriptions();
  } catch {
    return generateMockSubscriptions();
  }
}

function saveSubscriptions(subscriptions: Subscription[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(subscriptions));
  } catch {
    // Ignore storage issues
  }
}

/** Grand total for one billing cycle (after subscription discount and tax). */
export function calculateSubscriptionTotal(subscription: Subscription): number {
  if (typeof subscription.total === "number") return subscription.total;
  return calculateTotals(subscription.lines, undefined).total;
}

export function calculateTotals(
  lines: SubscriptionLine[],
  discount?: Discount,
): { subtotal: number; discountTotal: number; taxTotal: number; total: number } {
  const subtotal = lines.reduce(
    (sum, line) => sum + line.quantity * line.unitPrice,
    0,
  );

  const lineDiscount = lines.reduce((sum, line) => {
    if (!line.discountValue) return sum;
    const lineSubtotal = line.quantity * line.unitPrice;
    return (
      sum +
      (line.discountType === "percent"
        ? lineSubtotal * (line.discountValue / 100)
        : Math.min(line.discountValue, lineSubtotal))
    );
  }, 0);

  const discountTotal = discount
    ? discount.type === "percent"
      ? (subtotal - lineDiscount) * (discount.value / 100)
      : Math.min(discount.value, subtotal - lineDiscount)
    : lineDiscount;

  const taxable = Math.max(subtotal - discountTotal, 0);
  const effectiveTaxRate =
    lines.length > 0
      ? lines.reduce((sum, line) => sum + line.taxRatePercent, 0) / lines.length
      : 0;
  const taxTotal = taxable * (effectiveTaxRate / 100);
  const round = (value: number) => Math.round(value * 100) / 100;

  return {
    subtotal: round(subtotal),
    discountTotal: round(discountTotal),
    taxTotal: round(taxTotal),
    total: round(taxable + taxTotal),
  };
}

function filterSubscriptions(
  list: Subscription[],
  params?: ListQuery,
): Subscription[] {
  let filtered = [...list];
  const filters = params?.filters ?? {};

  if (params?.search?.trim()) {
    const query = params.search.toLowerCase().trim();
    const customers = getStoredCustomers();
    const plans = getStoredPlans();
    const products = getStoredProducts();

    filtered = filtered.filter((subscription) => {
      const customer = customers.find(
        (item) => item.id === subscription.customerId,
      );
      const planNames = subscription.lines
        .map((line) => plans.find((plan) => plan.id === line.planId)?.name ?? "")
        .join(" ");
      const productNames = subscription.lines
        .map(
          (line) =>
            products.find((product) => product.id === line.productId)?.name ?? "",
        )
        .join(" ");

      return (
        subscription.subscriptionNumber.toLowerCase().includes(query) ||
        customer?.name.toLowerCase().includes(query) ||
        customer?.companyName?.toLowerCase().includes(query) ||
        planNames.toLowerCase().includes(query) ||
        productNames.toLowerCase().includes(query)
      );
    });
  }

  if (filters["planId"] && filters["planId"] !== "all") {
    filtered = filtered.filter((subscription) =>
      subscription.lines.some((line) => line.planId === filters["planId"]),
    );
  }

  if (filters["customerId"] && filters["customerId"] !== "all") {
    filtered = filtered.filter(
      (subscription) => subscription.customerId === filters["customerId"],
    );
  }

  if (filters["dateFrom"]) {
    const from = new Date(filters["dateFrom"]).getTime();
    filtered = filtered.filter(
      (subscription) => new Date(subscription.startDate).getTime() >= from,
    );
  }

  if (filters["dateTo"]) {
    const to = new Date(filters["dateTo"]).getTime();
    filtered = filtered.filter(
      (subscription) => new Date(subscription.startDate).getTime() <= to,
    );
  }

  if (filters["status"] && filters["status"] !== "all") {
    filtered = filtered.filter(
      (subscription) => subscription.status === filters["status"],
    );
  }

  return filtered;
}

function sortSubscriptions(
  list: Subscription[],
  sortBy?: string,
  sortOrder: "asc" | "desc" = "desc",
): Subscription[] {
  const direction = sortOrder === "desc" ? -1 : 1;
  const key = sortBy ?? "createdAt";

  return [...list].sort((a, b) => {
    const valueFor = (subscription: Subscription): string | number => {
      switch (key) {
        case "subscriptionNumber":
          return subscription.subscriptionNumber;
        case "status":
          return subscription.status;
        case "startDate":
          return new Date(subscription.startDate).getTime();
        case "endDate":
          return subscription.endDate
            ? new Date(subscription.endDate).getTime()
            : 0;
        case "nextBillingDate":
          return subscription.nextBillingDate
            ? new Date(subscription.nextBillingDate).getTime()
            : 0;
        case "total":
          return calculateSubscriptionTotal(subscription);
        case "customerId":
          return subscription.customerId;
        default:
          return new Date(subscription.createdAt).getTime();
      }
    };

    const aValue = valueFor(a);
    const bValue = valueFor(b);
    if (typeof aValue === "number" && typeof bValue === "number") {
      return (aValue - bValue) * direction;
    }
    return String(aValue).localeCompare(String(bValue)) * direction;
  });
}

export async function getSubscriptions(
  params?: ListQuery,
): Promise<SubscriptionListResult> {
  return apiRequest<SubscriptionListResult>("/subscriptions", {
    params,
    mock: () => {
      const base = getStoredSubscriptions();
      const filters = params?.filters ?? {};

      // Counts are computed before the status filter so every tab shows a number.
      const withoutStatus: ListQuery = {
        ...params,
        filters: { ...filters, status: "all" },
      };
      const beforeStatus = filterSubscriptions(base, withoutStatus);
      const statusCounts = SUBSCRIPTION_STATUSES.reduce(
        (counts, status) => {
          counts[status] = beforeStatus.filter(
            (subscription) => subscription.status === status,
          ).length;
          return counts;
        },
        { draft: 0, quotation: 0, confirmed: 0, active: 0, paused: 0, closed: 0 } as Record<
          SubscriptionStatus,
          number
        >,
      );

      const filtered = filterSubscriptions(base, params);
      const sorted = sortSubscriptions(
        filtered,
        params?.sortBy,
        params?.sortOrder,
      );

      const total = sorted.length;
      const page = Math.max(params?.page ?? 1, 1);
      const pageSize = params?.pageSize ?? 10;
      const start = (page - 1) * pageSize;

      return {
        items: sorted.slice(start, start + pageSize),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
        statusCounts,
      };
    },
  });
}

export async function getSubscriptionById(
  id: string,
): Promise<Subscription | undefined> {
  return apiRequest<Subscription | undefined>(`/subscriptions/${id}`, {
    mock: () => getStoredSubscriptions().find((subscription) => subscription.id === id),
  });
}

export interface CreateSubscriptionInput {
  customerId: string;
  planId: string;
  quotationTemplateId?: string;
  startDate: string;
  endDate: string;
  paymentTerms: PaymentTerms;
  status: Extract<SubscriptionStatus, "draft" | "quotation">;
  lines: Array<
    Omit<SubscriptionLine, "id" | "subscriptionId">
  >;
  discountId?: string;
}

export async function createSubscription(
  input: CreateSubscriptionInput,
): Promise<Subscription> {
  return apiRequest<Subscription>("/subscriptions", {
    method: "POST",
    body: input,
    mock: () => {
      const list = getStoredSubscriptions();
      const nextNumber =
        list.reduce((max, subscription) => {
          const numeric = Number(
            subscription.subscriptionNumber.replace(/\D/g, ""),
          );
          return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
        }, 100) + 1;

      const id = `sub_${Date.now()}`;
      const lines: SubscriptionLine[] = input.lines.map((line, index) => ({
        ...line,
        id: `line_${id}_${index}`,
        subscriptionId: id,
      }));

      const discount = input.discountId
        ? MOCK_DISCOUNTS.find((item) => item.id === input.discountId)
        : undefined;
      const totals = calculateTotals(lines, discount);

      const plan = getStoredPlans().find((item) => item.id === input.planId);
      const billingPeriod = plan?.billingPeriod ?? "monthly";
      const start = new Date(input.startDate);
      const nextBillingDate =
        input.status === "quotation"
          ? undefined
          : billingPeriod === "daily"
            ? addDays(start, 1)
            : billingPeriod === "weekly"
              ? addWeeks(start, 1)
              : billingPeriod === "yearly"
                ? addYears(start, 1)
                : addMonths(start, 1);

      const subscription: Subscription = {
        id,
        subscriptionNumber: `SUB-${String(nextNumber).padStart(6, "0")}`,
        customerId: input.customerId,
        quotationTemplateId: input.quotationTemplateId,
        status: input.status,
        lines,
        startDate: new Date(input.startDate).toISOString(),
        endDate: new Date(input.endDate).toISOString(),
        nextBillingDate: nextBillingDate?.toISOString(),
        paymentTerms: input.paymentTerms,
        createdAt: new Date().toISOString(),
        discountId: discount?.id,
        ...totals,
      };

      saveSubscriptions([subscription, ...list]);
      return subscription;
    },
  });
}

export async function updateSubscriptionStatus(
  id: string,
  status: SubscriptionStatus,
): Promise<Subscription> {
  return apiRequest<Subscription>(`/subscriptions/${id}/status`, {
    method: "PATCH",
    body: { status },
    mock: () => {
      const list = getStoredSubscriptions();
      const index = list.findIndex((subscription) => subscription.id === id);
      if (index === -1) throw new Error("Subscription not found");
      const existing = list[index]!;
      const updated: Subscription = {
        ...existing,
        status,
        closedAt: status === "closed" ? new Date().toISOString() : existing.closedAt,
        nextBillingDate:
          status === "active"
            ? addMonths(new Date(), 1).toISOString()
            : status === "closed"
              ? undefined
              : existing.nextBillingDate,
      };
      list[index] = updated;
      saveSubscriptions(list);
      return updated;
    },
  });
}

/** Extends the contract by one billing period and reactivates the subscription. */
export async function renewSubscription(id: string): Promise<Subscription> {
  return apiRequest<Subscription>(`/subscriptions/${id}/renew`, {
    method: "POST",
    mock: () => {
      const list = getStoredSubscriptions();
      const index = list.findIndex((subscription) => subscription.id === id);
      if (index === -1) throw new Error("Subscription not found");
      const existing = list[index]!;
      const plan = getStoredPlans().find(
        (item) => item.id === existing.lines[0]?.planId,
      );
      const billingPeriod = plan?.billingPeriod ?? "monthly";
      const today = startOfDay(new Date());
      const currentEnd = existing.endDate ? new Date(existing.endDate) : today;
      const base = currentEnd.getTime() > today.getTime() ? currentEnd : today;

      const nextEnd =
        billingPeriod === "daily"
          ? addDays(base, 1)
          : billingPeriod === "weekly"
            ? addWeeks(base, 1)
            : billingPeriod === "yearly"
              ? addYears(base, 1)
              : addMonths(base, 1);

      const updated: Subscription = {
        ...existing,
        status: "active",
        endDate: nextEnd.toISOString(),
        closedAt: undefined,
        nextBillingDate: addMonths(today, 1).toISOString(),
      };
      list[index] = updated;
      saveSubscriptions(list);
      return updated;
    },
  });
}

export async function duplicateSubscription(id: string): Promise<Subscription> {
  return apiRequest<Subscription>(`/subscriptions/${id}/duplicate`, {
    method: "POST",
    mock: () => {
      const list = getStoredSubscriptions();
      const source = list.find((subscription) => subscription.id === id);
      if (!source) throw new Error("Subscription not found");
      const newId = `sub_${Date.now()}`;
      const nextNumber =
        list.reduce((max, subscription) => {
          const numeric = Number(
            subscription.subscriptionNumber.replace(/\D/g, ""),
          );
          return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
        }, 100) + 1;

      const duplicate: Subscription = {
        ...source,
        id: newId,
        subscriptionNumber: `SUB-${String(nextNumber).padStart(6, "0")}`,
        status: "draft",
        lines: source.lines.map((line, lineIndex) => ({
          ...line,
          id: `line_${newId}_${lineIndex}`,
          subscriptionId: newId,
        })),
        createdAt: new Date().toISOString(),
        closedAt: undefined,
        nextBillingDate: undefined,
      };
      saveSubscriptions([duplicate, ...list]);
      return duplicate;
    },
  });
}

export async function deleteSubscription(id: string): Promise<boolean> {
  return apiRequest<boolean>(`/subscriptions/${id}`, {
    method: "DELETE",
    mock: () => {
      saveSubscriptions(
        getStoredSubscriptions().filter((subscription) => subscription.id !== id),
      );
      return true;
    },
  });
}

/** Helper used by the list page to resolve line references for display. */
export function resolveSubscriptionPlans(
  subscription: Subscription,
  plans: Plan[],
  products: Product[],
): string {
  const firstLine = subscription.lines[0];
  if (!firstLine) return "—";
  const plan = plans.find((item) => item.id === firstLine.planId);
  const product = products.find((item) => item.id === firstLine.productId);
  const base = plan?.name ?? product?.name ?? "Custom plan";
  return subscription.lines.length > 1
    ? `${base} +${subscription.lines.length - 1} more`
    : base;
}
