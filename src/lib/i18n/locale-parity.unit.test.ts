import { describe, expect, it } from "vitest";
import { en } from "./en";
import { bs } from "./bs";
import { de } from "./de";
import { fr } from "./fr";
import { es } from "./es";

// A key missing from a locale falls back to English silently, so a German
// user sees mixed-language UI. Every locale must define every English key.
describe("locale parity with en", () => {
    const locales = { bs, de, fr, es };
    const enKeys = Object.keys(en);

    for (const [locale, translations] of Object.entries(locales)) {
        it(`"${locale}" defines every key in en`, () => {
            const missing = enKeys.filter((key) => !(translations as Record<string, string>)[key]?.trim());
            expect(missing, `${locale} is missing ${missing.length} key(s)`).toEqual([]);
        });

        it(`"${locale}" has no keys that en lacks`, () => {
            const extra = Object.keys(translations).filter((key) => !(key in en));
            expect(extra).toEqual([]);
        });

        // Translations may drop the English plural suffix {s} (French "CV" is
        // invariant), but must keep every other placeholder and add none.
        it(`"${locale}" keeps the {placeholders} from en`, () => {
            const names = (s: string) => new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
            const mismatched = enKeys.filter((key) => {
                const value = (translations as Record<string, string>)[key];
                if (!value) return false;
                const source = names(en[key]);
                const target = names(value);
                const dropped = [...source].some((name) => name !== "s" && !target.has(name));
                const added = [...target].some((name) => !source.has(name));
                return dropped || added;
            });
            expect(mismatched).toEqual([]);
        });
    }
});
