import { describe, expect, it } from "vitest";
import { STORAGE_REGISTRY } from "../registry";
import { bs } from "./bs";
import { de } from "./de";
import { en } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { formatStorageMessage } from "./index";

describe("Your data messages", () => {
    const locales = { bs, de, fr, es };

    for (const [locale, messages] of Object.entries(locales)) {
        it(`"${locale}" has exactly the English keys`, () => {
            const missing = Object.keys(en).filter((key) => !messages[key]?.trim());
            const extra = Object.keys(messages).filter((key) => !(key in en));
            expect({ missing, extra }).toEqual({ missing: [], extra: [] });
        });

        it(`"${locale}" keeps the {placeholders}`, () => {
            const names = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
            const mismatched = Object.keys(en).filter((key) => messages[key] && names(messages[key]).join() !== names(en[key]).join());
            expect(mismatched).toEqual([]);
        });
    }

    it("describes every active registry entry and every value the page shows", () => {
        const keys = STORAGE_REGISTRY.flatMap((entry) => [
            entry.status === "active" ? `storage.purpose.${entry.id}` : "storage.purpose.legacy",
            `storage.retention.${entry.retention}`,
            `storage.basis.${entry.legalBasis}`,
            `storage.owner.${entry.owner}`,
            `storage.location.${entry.location}`,
            ...(entry.removable === "yes" ? [] : [`storage.how.${entry.removable}`]),
        ]);
        expect(keys.filter((key) => !en[key])).toEqual([]);
    });

    it("formats plurals and falls back to English", () => {
        expect(formatStorageMessage(de, "yourData.summary.resumes", { count: 1 })).toBe("1 Lebenslauf");
        expect(formatStorageMessage(de, "yourData.summary.resumes", { count: 3 })).toBe("3 Lebensläufe");
        expect(formatStorageMessage({}, "yourData.title")).toBe("Your data");
    });

    it("uses a confirmation word per language", () => {
        expect(de["yourData.delete.confirmWord"]).toBe("LÖSCHEN");
        expect(en["yourData.delete.confirmWord"]).toBe("DELETE");
    });
});
