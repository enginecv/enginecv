import { describe, expect, it } from "vitest";
import { CONTENT_SECTIONS } from "@/components/editor/content-section-registry";
import { GUIDE_REGISTRY, SECTIONS_WITHOUT_GUIDE, getGuideForSection, getPublishedGuideEntries } from "./registry";

describe("guide registry", () => {
    it("has 13 guides with unique slugs and orders", () => {
        expect(GUIDE_REGISTRY).toHaveLength(13);
        expect(new Set(GUIDE_REGISTRY.map((entry) => entry.slug)).size).toBe(13);
        expect(new Set(GUIDE_REGISTRY.map((entry) => entry.order)).size).toBe(13);
    });

    it("ends every slug in -section", () => {
        expect(GUIDE_REGISTRY.filter((entry) => !/^[a-z0-9-]+-section$/.test(entry.slug)).map((entry) => entry.slug)).toEqual([]);
    });

    it("maps at most one guide to each editor section", () => {
        const ids = GUIDE_REGISTRY.flatMap((entry) => (entry.sectionId ? [entry.sectionId] : []));
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("maps only to real editor sections", () => {
        const known = new Set<string>(CONTENT_SECTIONS.map((section) => section.id));
        expect(GUIDE_REGISTRY.flatMap((entry) => (entry.sectionId && !known.has(entry.sectionId) ? [entry.sectionId] : []))).toEqual([]);
    });

    it("covers every editor section except the listed exemptions", () => {
        const mapped = new Set(GUIDE_REGISTRY.flatMap((entry) => (entry.sectionId ? [entry.sectionId] : [])));
        const missing = CONTENT_SECTIONS.map((section) => section.id).filter((id) => !mapped.has(id) && !SECTIONS_WITHOUT_GUIDE.includes(id));
        expect(missing, "editor sections with no guide and no exemption").toEqual([]);
    });

    it("returns only published guides for a section", () => {
        expect(getGuideForSection("basics")).toBeNull();
        for (const entry of GUIDE_REGISTRY) {
            if (!entry.sectionId) continue;
            expect(getGuideForSection(entry.sectionId)?.slug ?? null).toBe(entry.published ? entry.slug : null);
        }
        expect(getPublishedGuideEntries().every((entry) => entry.published)).toBe(true);
    });
});
