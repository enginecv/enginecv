import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, PREFIXED_LOCALES, type Locale } from "@/lib/i18n/locales";
import { getTools } from "@/lib/tools/registry";
import { toolMetadata, toolsIndexMetadata } from "@/lib/tools/tool-metadata";

const LOCALES: Locale[] = [DEFAULT_LOCALE, ...PREFIXED_LOCALES];

describe("tool page metadata", () => {
    it("points the index canonical at itself in each locale", () => {
        expect(toolsIndexMetadata("en").alternates?.canonical).toBe("/tools");
        expect(toolsIndexMetadata("de").alternates?.canonical).toBe("/de/tools");
    });

    it.each(getTools().map((tool) => [tool.slug, tool] as const))("%s has a self canonical and the full hreflang set", (slug, tool) => {
        expect(toolMetadata("en", tool).alternates?.canonical).toBe(`/tools/${slug}`);
        expect(toolMetadata("bs", tool).alternates?.canonical).toBe(`/bs/tools/${slug}`);
        expect(toolMetadata("de", tool).alternates?.languages).toEqual({
            en: `/tools/${slug}`,
            de: `/de/tools/${slug}`,
            bs: `/bs/tools/${slug}`,
            fr: `/fr/tools/${slug}`,
            es: `/es/tools/${slug}`,
            "x-default": `/tools/${slug}`,
        });
        expect(toolMetadata("de", tool).openGraph).toMatchObject({ locale: "de_DE", url: `/de/tools/${slug}` });
    });

    it("gives every tool and the index a unique title in each locale", () => {
        for (const locale of LOCALES) {
            const titles = [toolsIndexMetadata(locale), ...getTools().map((tool) => toolMetadata(locale, tool))].map((meta) => meta.title);
            expect(new Set(titles).size).toBe(titles.length);
        }
    });
});
