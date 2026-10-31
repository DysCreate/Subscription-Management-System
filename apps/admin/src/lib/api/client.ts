import type { ListQuery, User } from "@/types";

/**
 * The mock/real switch.
 *
 * Every API function in src/lib/api/ goes through `apiRequest`:
 *  - NEXT_PUBLIC_USE_MOCK=true  → realistic mock data with a simulated delay.
 *  - NEXT_PUBLIC_USE_MOCK=false  → fetch to `${NEXT_PUBLIC_API_URL}/api/v1/...`.
 */
export const USE_MOCK: boolean =
  (process.env["NEXT_PUBLIC_USE_MOCK"] ?? "true") !== "false";

export const API_URL: string =
  process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

export class ApiError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`API error ${status}: ${body}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export function delay(ms = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(): Promise<void> {
  // Simulated 200–500ms network latency for mock responses.
  const ms = Math.floor(Math.random() * 300) + 200;
  return delay(ms);
}

/** Query-string serialisation shared by list pages (page, search, sort, filters). */
function buildUrl(path: string, params?: ListQuery): string {
  const base = API_URL.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const full = base.endsWith("/api/v1") || normalizedPath.startsWith("/api/v1") ? `${base}${normalizedPath}` : `${base}/api/v1${normalizedPath}`;
  const url = new URL(full);
  if (params) {
    if (params.page != null) url.searchParams.set("page", String(params.page));
    if (params.pageSize != null)
      url.searchParams.set("pageSize", String(params.pageSize));
    if (params.search) url.searchParams.set("search", params.search);
    if (params.sortBy) url.searchParams.set("sortBy", params.sortBy);
    if (params.sortOrder) url.searchParams.set("sortOrder", params.sortOrder);
    for (const [key, value] of Object.entries(params.filters ?? {})) {
      if (value && value !== "all") url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

interface ApiRequestOptions {
  /** Query params for list endpoints (ignored by the mock switch). */
  params?: ListQuery;
  /** Mock resolver — only called when USE_MOCK is true. */
  mock: () => unknown;
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  extraHeaders?: Record<string, string>;
}

/**
 * Call this from every feature-module API function, e.g.:
 *
 *   export async function getProducts(params: ListQuery) {
 *     return apiRequest<Paginated<Product>>("/products", {
 *       params,
 *       mock: () => ({ items: MOCK_PRODUCTS, total: 42, ... }),
 *     });
 *   }
 */
export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions,
): Promise<T> {
  if (USE_MOCK) {
    await randomDelay();
    return options.mock() as T;
  }

  const headers: Record<string, string> = {
    ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...options.extraHeaders,
  };
  try {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("subloop_access_token") || localStorage.getItem("accessToken") || localStorage.getItem("token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }
  } catch {
    // ignore
  }

  const response = await fetch(buildUrl(path, options.params), {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    throw new ApiError(response.status, await response.text().catch(() => ""));
  }
  return (await response.json()) as T;
}

/* -------------------------------------------------------------------------- */
/* Current user (used by useAuth/RoleGate until the real auth module lands)    */
/* -------------------------------------------------------------------------- */

export const MOCK_CURRENT_USER: User = {
  id: "usr_admin_01",
  name: "Aarav Menon",
  email: "aarav@brightloop.software",
  role: "admin",
  createdAt: "2025-08-01T00:00:00.000Z",
};

export async function getCurrentUser(): Promise<User> {
  return apiRequest<User>("/auth/me", {
    mock: () => MOCK_CURRENT_USER,
  });
}
