import { describe, expect, it } from "vitest";
import { blogTranslationEntries, translateBlog } from "./blog-i18n";

describe("blog chrome translations", () => {
    const entries = blogTranslationEntries();

    it.each(["en", "de", "bs", "fr", "es"] as const)("has every key, non-empty, in %s", (locale) => {
        const english = entries.filter(([entryLocale]) => entryLocale === "en").map(([, key]) => key).sort();
        const keys = entries.filter(([entryLocale]) => entryLocale === locale);
        expect(keys.map(([, key]) => key).sort()).toEqual(english);
        for (const [, key, value] of keys) expect(value.trim(), `${locale} ${key}`).not.toBe("");
    });

    it("writes German and Bosnian with real diacritics, not ASCII stand-ins", () => {
        const text = (locale: string) => entries.filter(([entryLocale]) => entryLocale === locale).map(([, , value]) => value).join(" ");
        expect(text("de")).not.toMatch(/\b(Leitfaeden|Gespraech|Geraet|Ueberschrift|fuer|koennen|aendern)/i);
        expect(text("bs")).not.toMatch(/\b(clanak|clanka|citanja|Prakticni|uredaju|bocnom)\b/i);
    });

    it("fills parameters", () => {
        expect(translateBlog("de", "readingTime", { minutes: 4 })).toBe("4 Min. Lesezeit");
    });
});
