import { describe, expect, it } from "vitest";
import {
    getNextTemplateIndex,
    getPreviousTemplateIndex,
    getTemplateCounterParams,
    LANDING_SHOWCASE_TEMPLATE_LIMIT,
    limitShowcaseTemplates,
    normalizeTemplateIndex,
} from "./landing-template-carousel";

describe("landing template carousel helpers", () => {
    it("normalizes selected indexes into available template bounds", () => {
        expect(normalizeTemplateIndex(0, 5)).toBe(0);
        expect(normalizeTemplateIndex(4, 5)).toBe(4);
        expect(normalizeTemplateIndex(5, 5)).toBe(0);
        expect(normalizeTemplateIndex(-1, 5)).toBe(4);
        expect(normalizeTemplateIndex(7, 5)).toBe(2);
        expect(normalizeTemplateIndex(3, 0)).toBe(0);
    });

    it("wraps next and previous navigation at collection boundaries", () => {
        expect(getNextTemplateIndex(0, 3)).toBe(1);
        expect(getNextTemplateIndex(2, 3)).toBe(0);
        expect(getPreviousTemplateIndex(2, 3)).toBe(1);
        expect(getPreviousTemplateIndex(0, 3)).toBe(2);
        expect(getNextTemplateIndex(0, 1)).toBe(0);
        expect(getPreviousTemplateIndex(0, 1)).toBe(0);
        expect(getNextTemplateIndex(0, 0)).toBe(0);
        expect(getPreviousTemplateIndex(0, 0)).toBe(0);
    });

    it("returns one-based counter params for localized labels", () => {
        expect(getTemplateCounterParams(0, 5)).toEqual({ current: 1, total: 5 });
        expect(getTemplateCounterParams(4, 5)).toEqual({ current: 5, total: 5 });
        expect(getTemplateCounterParams(5, 5)).toEqual({ current: 1, total: 5 });
        expect(getTemplateCounterParams(0, 0)).toEqual({ current: 0, total: 0 });
    });

    it("caps the showcase at the landing limit without touching smaller lists", () => {
        const eighteen = Array.from({ length: 18 }, (_, index) => index);
        expect(limitShowcaseTemplates(eighteen)).toHaveLength(LANDING_SHOWCASE_TEMPLATE_LIMIT);
        expect(limitShowcaseTemplates(eighteen)).toEqual(eighteen.slice(0, 10));
        expect(limitShowcaseTemplates([1, 2, 3])).toEqual([1, 2, 3]);
        expect(limitShowcaseTemplates([])).toEqual([]);
    });
});
