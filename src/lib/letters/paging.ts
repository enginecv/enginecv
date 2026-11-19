/** One page of a list: the page number is clamped into range, so a stale page never shows nothing. */
export interface PageOf<T> {
    items: T[];
    page: number;
    pageCount: number;
    total: number;
}

export function pageOf<T>(items: readonly T[], page: number, size: number): PageOf<T> {
    const total = items.length;
    const pageCount = Math.max(1, Math.ceil(total / Math.max(1, size)));
    const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
    return { items: items.slice((current - 1) * size, current * size), page: current, pageCount, total };
}
