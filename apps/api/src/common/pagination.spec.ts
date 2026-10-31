import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, buildPageMeta, resolvePagination } from '@subloop/shared';

describe('pagination', () => {
  it('defaults to page 1 with the default page size', () => {
    expect(resolvePagination({})).toEqual({
      page: 1,
      limit: DEFAULT_PAGE_SIZE,
      skip: 0,
      take: DEFAULT_PAGE_SIZE,
    });
  });

  it('clamps the page size so no list endpoint can dump the table', () => {
    expect(resolvePagination({ limit: 5000 }).limit).toBe(MAX_PAGE_SIZE);
  });

  it('never allows page 0 or negative pages', () => {
    expect(resolvePagination({ page: 0 }).page).toBe(1);
    expect(resolvePagination({ page: -3 }).page).toBe(1);
  });

  it('computes skip from page and limit', () => {
    expect(resolvePagination({ page: 3, limit: 25 }).skip).toBe(50);
  });

  it('builds page metadata', () => {
    const meta = buildPageMeta({ page: 2, limit: 20, skip: 20, take: 20 }, 45);
    expect(meta).toEqual({ page: 2, limit: 20, total: 45, totalPages: 3 });
  });
});
