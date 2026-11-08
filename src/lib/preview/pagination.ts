import type {
    LayoutItemRender,
    LayoutSectionPlacement,
    OrderableSection,
    PositionedLayoutItem,
    PreviewBlock,
    PreviewFlowItem,
    PreviewRenderableItem,
    PreviewSection,
} from "./pagination-types";

export function getPreviewSectionBaseId(sectionKey: string) {
    return sectionKey.split(":")[0];
}

export function isPreviewSeparatorKey(sectionKey: string) {
    return getPreviewSectionBaseId(sectionKey) === "separator";
}

export function isPreviewVerticalSeparatorKey(sectionKey: string) {
    return getPreviewSectionBaseId(sectionKey) === "vertical-separator";
}

export function isPreviewPageBreakKey(sectionKey: string) {
    return getPreviewSectionBaseId(sectionKey) === "pagebreak";
}

export function resolvePreviewFlowOrder<T extends OrderableSection = PreviewSection>(
    order: string[],
    sections: T[],
) {
    const byBase = new Map<string, T>(sections.map((section) => [section.base, section]));
    const used = new Set<string>();
    const resolved: PreviewFlowItem<T>[] = [];

    order.forEach((entry) => {
        if (entry === "basic") {
            return;
        }

        if (isPreviewSeparatorKey(entry)) {
            resolved.push({ key: entry, kind: "separator" });
            return;
        }

        if (isPreviewVerticalSeparatorKey(entry)) {
            resolved.push({ key: entry, kind: "vertical-separator" });
            return;
        }

        if (isPreviewPageBreakKey(entry)) {
            resolved.push({ key: entry, kind: "page-break" });
            return;
        }

        const direct = sections.find((section) => section.key === entry) || null;
        const mapped = direct || byBase.get(getPreviewSectionBaseId(entry)) || null;
        if (mapped && !used.has(mapped.key)) {
            resolved.push({ key: mapped.key, kind: "section", section: mapped });
            used.add(mapped.key);
        }
    });

    sections.forEach((section) => {
        if (!used.has(section.key)) {
            resolved.push({ key: section.key, kind: "section", section });
            used.add(section.key);
        }
    });

    return resolved;
}

export function resolvePreviewRenderableItems(flowItems: PreviewFlowItem[]) {
    const resolved: PreviewRenderableItem[] = [];

    for (let index = 0; index < flowItems.length; index += 1) {
        const current = flowItems[index];
        const next = flowItems[index + 1];
        const nextNext = flowItems[index + 2];

        if (
            current?.kind === "section" &&
            current.section &&
            next?.kind === "vertical-separator" &&
            nextNext?.kind === "section" &&
            nextNext.section
        ) {
            resolved.push({
                key: `pair:${current.key}:${next.key}:${nextNext.key}`,
                kind: "section-pair",
                leftSection: current.section,
                rightSection: nextNext.section,
            });
            index += 2;
            continue;
        }

        resolved.push(current);
    }

    return resolved;
}

export function getDefaultLayoutPlacement(index: number, mode: "two" | "mix"): LayoutSectionPlacement {
    if (mode === "mix" && index === 0) return "full";
    return index % 2 === 0 ? "left" : "right";
}

export function normalizeLayoutPlacement(
    value: string | undefined,
    index: number,
    mode: "two" | "mix",
): LayoutSectionPlacement {
    if (mode === "two") {
        // Two columns have no full-width row: honour an explicit side, otherwise alternate.
        return value === "left" || value === "right" ? value : getDefaultLayoutPlacement(index, "two");
    }

    if (value === "left" || value === "right" || value === "full") {
        return value;
    }

    return getDefaultLayoutPlacement(index, "mix");
}

export function chunkSectionEntries(
    headingHeight: number,
    entryHeights: number[],
    usableHeight: number,
    startOffset = 0,
) {
    const chunks: Array<{ includeHeading: boolean; entryIndices: number[] }> = [];

    if (entryHeights.length === 0) {
        return [{ includeHeading: true, entryIndices: [] }];
    }

    // The first chunk only has the space left in the current column below
    // whatever is already placed there; every later chunk starts a fresh page.
    let capacity = Math.min(Math.max(usableHeight - startOffset, 0), usableHeight);
    let current: { includeHeading: boolean; entryIndices: number[] } | null = null;
    let currentHeight = 0;

    entryHeights.forEach((entryHeight, index) => {
        const needsHeading = index === 0;
        const entryBlockHeight = entryHeight + (needsHeading ? headingHeight : 0);

        if (!current) {
            // Even the first block cannot use the leftover space, so let the
            // section start on a fresh page instead of overflowing the column.
            if (entryBlockHeight > capacity) {
                capacity = usableHeight;
            }
            current = { includeHeading: needsHeading, entryIndices: [index] };
            currentHeight = entryBlockHeight;
            return;
        }

        if (currentHeight + entryHeight <= capacity) {
            current.entryIndices.push(index);
            currentHeight += entryHeight;
            return;
        }

        chunks.push(current);
        capacity = usableHeight;
        current = { includeHeading: false, entryIndices: [index] };
        currentHeight = entryHeight;
    });

    if (current) {
        chunks.push(current);
    }

    if (chunks.length > 0 && chunks[0].entryIndices.length > 0) {
        chunks[0].includeHeading = true;
    }

    return chunks;
}

export function getMeasuredBlockFootprints(
    children: HTMLElement[],
    container: HTMLElement,
    paddingBottomPx: number,
) {
    const contentBottom = container.scrollHeight - Math.max(0, paddingBottomPx);

    return children.map((child, index) => {
        const nextChild = children[index + 1];
        if (nextChild) {
            return nextChild.offsetTop - child.offsetTop;
        }

        return Math.max(child.offsetHeight, contentBottom - child.offsetTop);
    });
}

export function chunkPreviewBlocks(blocks: PreviewBlock[], blockHeights: number[], usableHeight: number) {
    const units: Array<{ indices: number[]; height: number; forcePageBreak?: boolean }> = [];

    for (let index = 0; index < blocks.length; index += 1) {
        const block = blocks[index];
        const nextBlock = blocks[index + 1];

        if (block.kind === "page-break") {
            units.push({
                indices: [],
                height: 0,
                forcePageBreak: true,
            });
            continue;
        }

        if (
            block.kind === "section-heading" &&
            nextBlock?.kind === "entry" &&
            nextBlock.section === block.section
        ) {
            units.push({
                indices: [index, index + 1],
                height: (blockHeights[index] ?? 0) + (blockHeights[index + 1] ?? 0),
            });
            index += 1;
            continue;
        }

        units.push({
            indices: [index],
            height: blockHeights[index] ?? 0,
        });
    }

    const chunks: number[][] = [[]];
    let currentHeight = 0;

    units.forEach((unit) => {
        if (unit.forcePageBreak) {
            if (chunks[chunks.length - 1].length > 0) {
                chunks.push([]);
            }
            currentHeight = 0;
            return;
        }

        if (chunks[chunks.length - 1].length > 0 && currentHeight + unit.height > usableHeight) {
            chunks.push([]);
            currentHeight = 0;
        }

        chunks[chunks.length - 1].push(...unit.indices);
        currentHeight += unit.height;
    });

    if (chunks.length > 1 && chunks[chunks.length - 1].length === 0) {
        chunks.pop();
    }

    return chunks;
}

export function areLayoutRendersEqual(a: LayoutItemRender, b: LayoutItemRender): boolean {
    if (a.type !== b.type) {
        return false;
    }

    switch (a.type) {
        case "profile":
            return true;
        case "paired":
        case "vseparator":
        case "separator":
            return a.itemKey === (b as { itemKey: string }).itemKey;
        case "chunk": {
            const other = b as Extract<LayoutItemRender, { type: "chunk" }>;
            return a.sectionKey === other.sectionKey
                && a.includeHeading === other.includeHeading
                && a.entryIndices.length === other.entryIndices.length
                && a.entryIndices.every((value, index) => value === other.entryIndices[index]);
        }
    }
}

export function arePositionedLayoutsEqual(left: PositionedLayoutItem[][], right: PositionedLayoutItem[][]) {
    if (left.length !== right.length) {
        return false;
    }

    return left.every((page, pageIndex) => {
        const otherPage = right[pageIndex];
        if (!otherPage || page.length !== otherPage.length) {
            return false;
        }

        return page.every((item, itemIndex) => {
            const otherItem = otherPage[itemIndex];
            return !!otherItem
                && item.key === otherItem.key
                && item.x === otherItem.x
                && item.y === otherItem.y
                && item.width === otherItem.width
                && areLayoutRendersEqual(item.render, otherItem.render);
        });
    });
}
