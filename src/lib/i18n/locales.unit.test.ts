import { describe, expect, it } from "vitest";
import { documentLocale } from "./locales";

describe("documentLocale", () => {
    it.each(["/", "/blog", "/blog/article", "/tools", "/tools/cefr-level", "/cv-templates", "/cv-templates/modern"])("keeps %s English regardless of saved language", (path) => {
        expect(documentLocale(path, "bs")).toBe("en");
    });

    it.each(["bs", "de", "fr", "es"] as const)("uses the %s URL prefix over the saved language", (locale) => {
        expect(documentLocale(`/${locale}/blog`, "en")).toBe(locale);
    });

    it.each(["/contact", "/dashboard", "/editor/local-id", "/templates/local-id", "/blogger"])("keeps the saved preference on %s", (path) => {
        expect(documentLocale(path, "bs")).toBe("bs");
    });
});
