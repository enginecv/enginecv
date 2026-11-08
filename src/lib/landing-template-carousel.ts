/** How many templates the landing hero carousel shows at most. */
export const LANDING_SHOWCASE_TEMPLATE_LIMIT = 10;

export function limitShowcaseTemplates<T>(templates: T[]): T[] {
    return templates.slice(0, LANDING_SHOWCASE_TEMPLATE_LIMIT);
}

export function normalizeTemplateIndex(index: number, total: number): number {
    if (total <= 0) return 0;
    return ((index % total) + total) % total;
}

export function getNextTemplateIndex(index: number, total: number): number {
    if (total <= 1) return 0;
    return normalizeTemplateIndex(index + 1, total);
}

export function getPreviousTemplateIndex(index: number, total: number): number {
    if (total <= 1) return 0;
    return normalizeTemplateIndex(index - 1, total);
}

export function getTemplateCounterParams(index: number, total: number): { current: number; total: number } {
    if (total <= 0) return { current: 0, total: 0 };
    return {
        current: normalizeTemplateIndex(index, total) + 1,
        total,
    };
}
