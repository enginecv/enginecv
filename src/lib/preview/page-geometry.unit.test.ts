import { describe, expect, it } from "vitest";
import { derivePageGeometry } from "./page-geometry";

const PX_PER_MM = 96 / 25.4;
const A4_HEIGHT_PX = 297 * PX_PER_MM;

describe("derivePageGeometry", () => {
    it("subtracts both vertical margins and the footer band from page height", () => {
        const margin = 20 * PX_PER_MM;
        const footer = 24;
        const geo = derivePageGeometry({
            pageContentHeight: A4_HEIGHT_PX,
            marginVerticalPx: margin,
            footerHeightPx: footer,
        });

        expect(geo.usableContentHeightPx).toBeCloseTo(A4_HEIGHT_PX - margin * 2 - footer, 5);
        expect(geo.topPaddingPx).toBe(margin);
        expect(geo.bottomPaddingPx).toBe(margin);
        expect(geo.footerBandPx).toBe(footer);
    });

    it("preserves the contentBottom == footerTop invariant", () => {
        const geo = derivePageGeometry({
            pageContentHeight: A4_HEIGHT_PX,
            marginVerticalPx: 30,
            footerHeightPx: 18,
        });

        expect(geo.contentBottomPx).toBeCloseTo(geo.footerTopPx, 5);
    });

    it("preserves the partition invariant: top + usable + footer + bottom == page height", () => {
        const geo = derivePageGeometry({
            pageContentHeight: A4_HEIGHT_PX,
            marginVerticalPx: 40,
            footerHeightPx: 32,
        });

        const total =
            geo.topPaddingPx + geo.usableContentHeightPx + geo.footerBandPx + geo.bottomPaddingPx;
        expect(total).toBeCloseTo(A4_HEIGHT_PX, 5);
    });

    it("treats footerHeightPx of 0 as no footer band", () => {
        const margin = 20 * PX_PER_MM;
        const geo = derivePageGeometry({
            pageContentHeight: A4_HEIGHT_PX,
            marginVerticalPx: margin,
            footerHeightPx: 0,
        });

        expect(geo.footerBandPx).toBe(0);
        expect(geo.usableContentHeightPx).toBeCloseTo(A4_HEIGHT_PX - margin * 2, 5);
        expect(geo.footerTopPx).toBeCloseTo(A4_HEIGHT_PX - margin, 5);
        expect(geo.contentBottomPx).toBeCloseTo(geo.footerTopPx, 5);
    });

    it("scales footer band when heightLines > 1 (caller passes footerHeightPx already multiplied)", () => {
        const baseLine = 16;
        const geo1 = derivePageGeometry({
            pageContentHeight: A4_HEIGHT_PX,
            marginVerticalPx: 20,
            footerHeightPx: baseLine,
        });
        const geo3 = derivePageGeometry({
            pageContentHeight: A4_HEIGHT_PX,
            marginVerticalPx: 20,
            footerHeightPx: baseLine * 3,
        });

        expect(geo3.usableContentHeightPx).toBeCloseTo(geo1.usableContentHeightPx - baseLine * 2, 5);
        expect(geo3.footerTopPx).toBeCloseTo(geo1.footerTopPx - baseLine * 2, 5);
    });

    it("clamps usable content height to 0 when margins + footer exceed the page", () => {
        const geo = derivePageGeometry({
            pageContentHeight: 100,
            marginVerticalPx: 80,
            footerHeightPx: 200,
        });

        expect(geo.usableContentHeightPx).toBe(0);
        expect(geo.contentBottomPx).toBe(geo.contentTopPx);
    });

    it("clamps negative or NaN-like inputs to non-negative values", () => {
        const geo = derivePageGeometry({
            pageContentHeight: -50,
            marginVerticalPx: -10,
            footerHeightPx: -5,
        });

        expect(geo.topPaddingPx).toBe(0);
        expect(geo.bottomPaddingPx).toBe(0);
        expect(geo.footerBandPx).toBe(0);
        expect(geo.usableContentHeightPx).toBe(0);
    });

    it("returns a stable result for identical inputs (referential safety check)", () => {
        const input = {
            pageContentHeight: A4_HEIGHT_PX,
            marginVerticalPx: 24,
            footerHeightPx: 18,
        };
        const a = derivePageGeometry(input);
        const b = derivePageGeometry(input);
        expect(a).toEqual(b);
    });
});
