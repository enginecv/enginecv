import { describe, it, expect } from "vitest";
import { computePanBounds, clampPan, type PanBounds } from "./pan-bounds";

const ZERO_BOUNDS: PanBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };

describe("computePanBounds", () => {
    it("locks to zero on both axes when content is smaller than viewport", () => {
        const bounds = computePanBounds(
            { width: 1000, height: 800 },
            { width: 400, height: 300 },
        );
        expect(bounds).toEqual(ZERO_BOUNDS);
    });

    it("locks to zero on both axes when content equals viewport", () => {
        const bounds = computePanBounds(
            { width: 800, height: 600 },
            { width: 800, height: 600 },
        );
        expect(bounds).toEqual(ZERO_BOUNDS);
    });

    it("returns symmetric range on each axis when content exceeds viewport", () => {
        const bounds = computePanBounds(
            { width: 800, height: 600 },
            { width: 1200, height: 1000 },
        );
        expect(bounds).toEqual({
            minX: -200,
            maxX: 200,
            minY: -200,
            maxY: 200,
        });
    });

    it("locks one axis and opens the other when only one dimension exceeds", () => {
        const bounds = computePanBounds(
            { width: 800, height: 600 },
            { width: 1200, height: 400 },
        );
        expect(bounds).toEqual({
            minX: -200,
            maxX: 200,
            minY: 0,
            maxY: 0,
        });
    });

    it("treats zero-size viewport as fully locked", () => {
        const bounds = computePanBounds(
            { width: 0, height: 0 },
            { width: 1200, height: 1000 },
        );
        expect(bounds).toEqual(ZERO_BOUNDS);
    });

    it("treats zero-size content as fully locked", () => {
        const bounds = computePanBounds(
            { width: 800, height: 600 },
            { width: 0, height: 0 },
        );
        expect(bounds).toEqual(ZERO_BOUNDS);
    });

    it("treats negative inputs as zero (no NaN, no throw)", () => {
        const bounds = computePanBounds(
            { width: -100, height: -100 },
            { width: -50, height: -50 },
        );
        expect(bounds).toEqual(ZERO_BOUNDS);
    });

    it("handles fractional sizes without rounding errors that change axis lock state", () => {
        const bounds = computePanBounds(
            { width: 794.5, height: 1123.5 },
            { width: 1191.75, height: 1685.25 },
        );
        expect(bounds.minX).toBeCloseTo(-(1191.75 - 794.5) / 2, 6);
        expect(bounds.maxX).toBeCloseTo((1191.75 - 794.5) / 2, 6);
        expect(bounds.minY).toBeCloseTo(-(1685.25 - 1123.5) / 2, 6);
        expect(bounds.maxY).toBeCloseTo((1685.25 - 1123.5) / 2, 6);
    });

    it("ranges always satisfy minX <= 0 <= maxX and minY <= 0 <= maxY", () => {
        const cases: Array<[{ width: number; height: number }, { width: number; height: number }]> = [
            [{ width: 100, height: 100 }, { width: 50, height: 50 }],
            [{ width: 100, height: 100 }, { width: 100, height: 100 }],
            [{ width: 100, height: 100 }, { width: 200, height: 200 }],
            [{ width: 50, height: 200 }, { width: 100, height: 100 }],
        ];
        for (const [v, c] of cases) {
            const b = computePanBounds(v, c);
            expect(b.minX).toBeLessThanOrEqual(0);
            expect(b.maxX).toBeGreaterThanOrEqual(0);
            expect(b.minY).toBeLessThanOrEqual(0);
            expect(b.maxY).toBeGreaterThanOrEqual(0);
        }
    });
});

describe("clampPan", () => {
    const bounds: PanBounds = { minX: -100, maxX: 100, minY: -50, maxY: 50 };

    it("returns the input pan unchanged when it is inside the bounds", () => {
        expect(clampPan({ x: 10, y: -20 }, bounds)).toEqual({ x: 10, y: -20 });
    });

    it("clamps to maxX when pan.x exceeds maxX", () => {
        expect(clampPan({ x: 9999, y: 0 }, bounds)).toEqual({ x: 100, y: 0 });
    });

    it("clamps to minX when pan.x goes below minX", () => {
        expect(clampPan({ x: -9999, y: 0 }, bounds)).toEqual({ x: -100, y: 0 });
    });

    it("clamps to maxY when pan.y exceeds maxY", () => {
        expect(clampPan({ x: 0, y: 9999 }, bounds)).toEqual({ x: 0, y: 50 });
    });

    it("clamps to minY when pan.y goes below minY", () => {
        expect(clampPan({ x: 0, y: -9999 }, bounds)).toEqual({ x: 0, y: -50 });
    });

    it("clamps both axes simultaneously", () => {
        expect(clampPan({ x: 9999, y: -9999 }, bounds)).toEqual({ x: 100, y: -50 });
    });

    it("is idempotent: clampPan(clampPan(p, b), b) === clampPan(p, b)", () => {
        const cases = [
            { x: 9999, y: -9999 },
            { x: 0, y: 0 },
            { x: 50, y: 25 },
            { x: -200, y: 75 },
        ];
        for (const p of cases) {
            const once = clampPan(p, bounds);
            const twice = clampPan(once, bounds);
            expect(twice).toEqual(once);
        }
    });

    it("keeps the centered default {x:0,y:0} valid for any bounds produced by computePanBounds", () => {
        const cases: Array<[{ width: number; height: number }, { width: number; height: number }]> = [
            [{ width: 100, height: 100 }, { width: 50, height: 50 }],
            [{ width: 100, height: 100 }, { width: 100, height: 100 }],
            [{ width: 100, height: 100 }, { width: 200, height: 200 }],
            [{ width: 800, height: 600 }, { width: 1200, height: 400 }],
        ];
        for (const [v, c] of cases) {
            const b = computePanBounds(v, c);
            expect(clampPan({ x: 0, y: 0 }, b)).toEqual({ x: 0, y: 0 });
        }
    });

    it("fully-locked bounds force any pan to {0,0}", () => {
        expect(clampPan({ x: 999, y: -999 }, ZERO_BOUNDS)).toEqual({ x: 0, y: 0 });
    });
});

describe("computePanBounds + clampPan integration cases for the resume preview", () => {
    it("at fit-to-viewport, single-page content equal to viewport locks pan to zero on both axes", () => {
        const paper = { width: 794, height: 1123 };
        const scale = 0.5;
        const content = { width: paper.width * scale, height: paper.height * scale };
        const viewport = { width: content.width, height: content.height };
        const bounds = computePanBounds(viewport, content);
        expect(clampPan({ x: 9999, y: 9999 }, bounds)).toEqual({ x: 0, y: 0 });
    });

    it("at 2x of fit zoom, single-page content allows symmetric panning to each edge", () => {
        const viewport = { width: 800, height: 1131 };
        const paper = { width: 794, height: 1123 };
        const fitScale = viewport.width / paper.width;
        const scale = fitScale * 2;
        const content = { width: paper.width * scale, height: paper.height * scale };
        const bounds = computePanBounds(viewport, content);

        const halfX = (content.width - viewport.width) / 2;
        const halfY = (content.height - viewport.height) / 2;
        expect(bounds).toEqual({ minX: -halfX, maxX: halfX, minY: -halfY, maxY: halfY });
        expect(clampPan({ x: 9999, y: 9999 }, bounds)).toEqual({ x: halfX, y: halfY });
        expect(clampPan({ x: -9999, y: -9999 }, bounds)).toEqual({ x: -halfX, y: -halfY });
    });

    it("multi-page document with inter-page gap still produces a clampable, symmetric range", () => {
        const viewport = { width: 800, height: 600 };
        const paper = { width: 794, height: 1123 };
        const scale = 0.5;
        const pageCount = 3;
        const interPageGap = 32;
        const content = {
            width: paper.width * scale,
            height: paper.height * scale * pageCount + interPageGap * (pageCount - 1),
        };
        const bounds = computePanBounds(viewport, content);
        expect(bounds.minX).toBe(0);
        expect(bounds.maxX).toBe(0);
        expect(bounds.minY).toBeLessThan(0);
        expect(bounds.maxY).toBeGreaterThan(0);
        expect(bounds.maxY).toBeCloseTo((content.height - viewport.height) / 2, 6);
    });
});
