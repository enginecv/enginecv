import { describe, expect, it } from "vitest";
import {
    arePositionedLayoutsEqual,
    areLayoutRendersEqual,
    chunkPreviewBlocks,
    chunkSectionEntries,
    normalizeLayoutPlacement,
    resolvePreviewRenderableItems,
} from "./pagination";
import type { LayoutItemRender, PositionedLayoutItem, PreviewBlock, PreviewFlowItem, PreviewSection } from "./pagination-types";

function section(key: string): PreviewSection {
    return { key, base: "experience", headingNode: null, entryNodes: [] };
}

describe("areLayoutRendersEqual", () => {
    it("treats two freshly built chunk descriptors with the same shape as equal", () => {
        // Regression: the old code compared React node identity here, so equality
        // was always false and the pagination effect never converged.
        const a: LayoutItemRender = { type: "chunk", sectionKey: "experience", includeHeading: true, entryIndices: [0, 1] };
        const b: LayoutItemRender = { type: "chunk", sectionKey: "experience", includeHeading: true, entryIndices: [0, 1] };
        expect(areLayoutRendersEqual(a, b)).toBe(true);
    });

    it("distinguishes different entry sets", () => {
        const a: LayoutItemRender = { type: "chunk", sectionKey: "experience", includeHeading: true, entryIndices: [0, 1] };
        const b: LayoutItemRender = { type: "chunk", sectionKey: "experience", includeHeading: true, entryIndices: [0, 2] };
        expect(areLayoutRendersEqual(a, b)).toBe(false);
    });

    it("distinguishes descriptor types and keyed items", () => {
        expect(areLayoutRendersEqual({ type: "profile" }, { type: "separator", itemKey: "x" })).toBe(false);
        expect(areLayoutRendersEqual({ type: "separator", itemKey: "a" }, { type: "separator", itemKey: "b" })).toBe(false);
        expect(areLayoutRendersEqual({ type: "profile" }, { type: "profile" })).toBe(true);
    });
});

describe("arePositionedLayoutsEqual", () => {
    const item = (overrides: Partial<PositionedLayoutItem> = {}): PositionedLayoutItem => ({
        key: "k",
        render: { type: "profile" },
        x: 0,
        y: 0,
        width: 100,
        ...overrides,
    });

    it("converges on structurally identical layouts rebuilt each frame", () => {
        expect(arePositionedLayoutsEqual([[item()]], [[item()]])).toBe(true);
    });

    it("detects geometry and page-count changes", () => {
        expect(arePositionedLayoutsEqual([[item({ y: 0 })]], [[item({ y: 10 })]])).toBe(false);
        expect(arePositionedLayoutsEqual([[item()]], [[item()], [item()]])).toBe(false);
    });
});

describe("chunkSectionEntries", () => {
    it("keeps the heading with the first chunk and only the first chunk", () => {
        const chunks = chunkSectionEntries(50, [100, 100, 100], 250);
        expect(chunks[0].includeHeading).toBe(true);
        expect(chunks.slice(1).every((c) => !c.includeHeading)).toBe(true);
    });

    it("returns a heading-only chunk for an empty section", () => {
        expect(chunkSectionEntries(50, [], 1000)).toEqual([{ includeHeading: true, entryIndices: [] }]);
    });

    it("sizes the first chunk to the space left in the column, not the full page", () => {
        // Page 250 tall, 100 already used: heading (50) + one entry (100) fit
        // the remaining 150; the rest flows to full-height pages.
        const chunks = chunkSectionEntries(50, [100, 100, 100], 250, 100);
        expect(chunks).toEqual([
            { includeHeading: true, entryIndices: [0] },
            { includeHeading: false, entryIndices: [1, 2] },
        ]);
    });

    it("starts on a fresh page when the leftover space cannot fit the first block", () => {
        // Only 40 left in the column but heading + entry need 150, so the first
        // chunk gets full-page capacity (placeItem pushes it to the next page).
        const chunks = chunkSectionEntries(50, [100, 100, 100], 250, 210);
        expect(chunks).toEqual([
            { includeHeading: true, entryIndices: [0, 1] },
            { includeHeading: false, entryIndices: [2] },
        ]);
    });

    it("keeps legacy behavior with a zero offset", () => {
        expect(chunkSectionEntries(50, [100, 100, 100], 250, 0))
            .toEqual(chunkSectionEntries(50, [100, 100, 100], 250));
    });
});

describe("chunkPreviewBlocks", () => {
    const block = (kind: PreviewBlock["kind"], section?: PreviewBlock["section"]): PreviewBlock => ({
        key: `${kind}:${section ?? ""}`,
        kind,
        node: null,
        section,
    });

    it("never orphans a heading from its first entry", () => {
        const blocks = [block("header"), block("section-heading", "experience"), block("entry", "experience")];
        const chunks = chunkPreviewBlocks(blocks, [200, 50, 60], 220);
        // header fills page 1; heading+entry must move together to page 2.
        expect(chunks).toHaveLength(2);
        expect(chunks[1]).toEqual([1, 2]);
    });

    it("forces a new page on an explicit page-break block", () => {
        const blocks = [block("header"), block("page-break"), block("entry", "experience")];
        const chunks = chunkPreviewBlocks(blocks, [50, 0, 50], 1000);
        expect(chunks).toHaveLength(2);
    });
});

describe("normalizeLayoutPlacement", () => {
    it("clamps to left/right in two-column mode regardless of full", () => {
        expect(normalizeLayoutPlacement("full", 0, "two")).toBe("left");
        expect(normalizeLayoutPlacement("right", 0, "two")).toBe("right");
        expect(normalizeLayoutPlacement("left", 1, "two")).toBe("left");
        expect(normalizeLayoutPlacement("left", 3, "two")).toBe("left");
        expect(normalizeLayoutPlacement(undefined, 3, "two")).toBe("right");
    });

    it("honors explicit placement in mix mode", () => {
        expect(normalizeLayoutPlacement("full", 3, "mix")).toBe("full");
    });
});

describe("resolvePreviewRenderableItems", () => {
    it("pairs two sections separated by a vertical separator", () => {
        const flow: PreviewFlowItem[] = [
            { key: "experience", kind: "section", section: section("experience") },
            { key: "vertical-separator:1", kind: "vertical-separator" },
            { key: "education", kind: "section", section: { ...section("education"), base: "education" } },
        ];
        const items = resolvePreviewRenderableItems(flow);
        expect(items).toHaveLength(1);
        expect(items[0].kind).toBe("section-pair");
    });
});
