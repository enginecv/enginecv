import { describe, expect, it } from "vitest";
import { bs } from "@/lib/i18n/bs";
import { de } from "@/lib/i18n/de";
import { en } from "@/lib/i18n/en";
import { es } from "@/lib/i18n/es";
import { fr } from "@/lib/i18n/fr";
import { RESOURCE_SECTIONS, hasSponsoredResources, internalResourcesFor, resourceLinkRel, type ResourceSection } from "@/lib/resources";

const links = RESOURCE_SECTIONS.flatMap((section) => section.links);

describe("resources", () => {
    it("links only to https URLs with unique ids", () => {
        for (const link of links) expect(link.url).toMatch(/^https:\/\//);
        expect(new Set(links.map((link) => link.id)).size).toBe(links.length);
    });

    it("has a description, section copy and next steps in every locale", () => {
        const keys = [
            ...links.map((link) => `resources.link.${link.id}`),
            ...links.map((link) => `resources.region.${link.region}`),
            ...RESOURCE_SECTIONS.flatMap((section) => [
                `resources.section.${section.id}.title`,
                `resources.section.${section.id}.intro`,
                ...section.internal.map((item) => `resources.internal.${item.id}`),
            ]),
        ];
        for (const [locale, dictionary] of Object.entries({ en, de, bs, fr, es })) {
            for (const key of keys) expect(dictionary[key], `${locale}: ${key}`).toBeTruthy();
        }
    });

    it("ships no sponsored link until a partner has approved one", () => {
        expect(hasSponsoredResources()).toBe(false);
    });

    it("marks sponsored links for crawlers", () => {
        const sponsored: ResourceSection = {
            id: "language",
            links: [{ id: "x", name: "X", url: "https://example.com", region: "de", sponsored: true }],
            internal: [],
        };
        expect(hasSponsoredResources([sponsored])).toBe(true);
        expect(resourceLinkRel(sponsored.links[0])).toContain("sponsored");
        expect(resourceLinkRel(links[0])).not.toContain("sponsored");
    });
});

describe("internalResourcesFor", () => {
    const work = RESOURCE_SECTIONS.find((section) => section.id === "work")!;

    it("offers CV examples only in a language that has published examples", () => {
        expect(internalResourcesFor(work, "en").map((item) => item.id)).toContain("examples");
        // German examples are drafts for now, and bs, fr and es have none: no link to a 404.
        for (const locale of ["de", "bs", "fr", "es"] as const) {
            expect(internalResourcesFor(work, locale).map((item) => item.id), locale).not.toContain("examples");
        }
    });

    it("keeps every other next step in every language", () => {
        for (const locale of ["en", "de", "bs", "fr", "es"] as const) {
            expect(internalResourcesFor(work, locale).map((item) => item.id), locale).toEqual(expect.arrayContaining(["europass", "templates"]));
        }
    });
});
