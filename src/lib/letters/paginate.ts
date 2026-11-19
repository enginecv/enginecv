/**
 * Splits measured blocks into pages. Blocks are kept whole: a block moves to the
 * next page rather than being cut. A block marked `keepWithNext` stays on the
 * same page as the block after it, which is how the last paragraph, the closing
 * and the signature are kept together (and the salutation with the first paragraph).
 */
export interface PageBlock {
    id: string;
    /** Rendered height in pixels, including the space below it. */
    height: number;
    keepWithNext?: boolean;
}

/** Consecutive blocks chained by `keepWithNext` form one unit that is never split. */
function toUnits(blocks: readonly PageBlock[]): { ids: string[]; height: number }[] {
    const units: { ids: string[]; height: number }[] = [];
    let current: { ids: string[]; height: number } | null = null;
    for (const block of blocks) {
        if (!current) current = { ids: [], height: 0 };
        current.ids.push(block.id);
        current.height += Math.max(0, block.height);
        if (!block.keepWithNext) {
            units.push(current);
            current = null;
        }
    }
    if (current) units.push(current);
    return units;
}

/**
 * Returns the block ids on each page. `usableHeight` may depend on the page (the German layout's first page has less room). A unit taller than a whole page still gets a
 * page of its own (it overflows rather than being lost). There is always at least
 * one page.
 */
export function paginateBlocks(blocks: readonly PageBlock[], usableHeight: number | ((pageIndex: number) => number)): string[][] {
    const heightOf = (pageIndex: number) => (typeof usableHeight === "number" ? usableHeight : usableHeight(pageIndex));
    const pages: string[][] = [[]];
    let used = 0;
    for (const unit of toUnits(blocks)) {
        const page = pages[pages.length - 1];
        if (page.length > 0 && used + unit.height > heightOf(pages.length - 1)) {
            pages.push([...unit.ids]);
            used = unit.height;
        } else {
            page.push(...unit.ids);
            used += unit.height;
        }
    }
    return pages;
}
