import type { z } from "zod";
import type { dashboardPageSizeSchema, dashboardSortSchema } from "./preferences/schema";

export type DashboardSort = z.infer<typeof dashboardSortSchema>;
export type DashboardPageSize = z.infer<typeof dashboardPageSizeSchema>;

export const DASHBOARD_SORTS: readonly DashboardSort[] = ["updated", "created", "name-asc", "name-desc"];
export const DASHBOARD_PAGE_SIZES: readonly DashboardPageSize[] = ["12", "24", "48", "all"];

export interface SortableListItem {
    name: string;
    createdAt?: number;
    updatedAt?: number;
}

/**
 * Stable sort: newest first for the date orders, locale-aware for names.
 * Untitled items sort after named ones in both name orders.
 */
export function sortDashboardItems<T>(items: readonly T[], sort: DashboardSort, describe: (item: T) => SortableListItem): T[] {
    const keyed = items.map((item, index) => ({ item, index, key: describe(item) }));
    const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

    keyed.sort((a, b) => {
        let order = 0;
        if (sort === "updated") order = (b.key.updatedAt ?? 0) - (a.key.updatedAt ?? 0);
        else if (sort === "created") order = (b.key.createdAt ?? 0) - (a.key.createdAt ?? 0);
        else {
            const aName = a.key.name.trim();
            const bName = b.key.name.trim();
            if (!aName !== !bName) return aName ? -1 : 1;
            order = collator.compare(aName, bName) * (sort === "name-desc" ? -1 : 1);
        }
        return order || a.index - b.index;
    });

    return keyed.map(({ item }) => item);
}

export interface DashboardPage<T> {
    items: T[];
    /** 1-based, clamped into range. */
    page: number;
    pageCount: number;
    total: number;
}

export function paginate<T>(items: readonly T[], page: number, pageSize: DashboardPageSize): DashboardPage<T> {
    const total = items.length;
    if (pageSize === "all") return { items: [...items], page: 1, pageCount: 1, total };

    const size = Number(pageSize);
    const pageCount = Math.max(1, Math.ceil(total / size));
    const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
    return { items: items.slice((current - 1) * size, current * size), page: current, pageCount, total };
}
