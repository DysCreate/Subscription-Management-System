export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface PaginationQuery {
  page?: number | string;
  limit?: number | string;
}

export interface Pagination {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

/**
 * Normalises page/limit into Prisma skip/take so no list endpoint can run
 * an unbounded query (architecture.md §8).
 */
export function resolvePagination(query: PaginationQuery = {}): Pagination {
  const page = Math.max(1, Math.trunc(Number(query.page) || 1));
  const rawLimit = Math.trunc(Number(query.limit) || DEFAULT_PAGE_SIZE);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, rawLimit));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export function buildPageMeta(pagination: Pagination, total: number): PageMeta {
  return {
    page: pagination.page,
    limit: pagination.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
  };
}

export function paginated<T>(data: T[], pagination: Pagination, total: number): Paginated<T> {
  return { data, meta: buildPageMeta(pagination, total) };
}
