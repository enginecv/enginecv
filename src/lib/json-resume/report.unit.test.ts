import { describe, expect, it } from "vitest";
import { bs } from "@/lib/i18n/bs";
import { de } from "@/lib/i18n/de";
import { en } from "@/lib/i18n/en";
import { es } from "@/lib/i18n/es";
import { fr } from "@/lib/i18n/fr";
import { LOSS_CODES, addLoss, emptyReport, hasLosses, itemsOfKind, mergeReports } from "./report";

describe("conversion report", () => {
    it("sums counts for the same code and section, and keeps different sections apart", () => {
        const report = emptyReport();
        addLoss(report, "left-out", "hidden-entries-left-out", "experience", 1);
        addLoss(report, "left-out", "hidden-entries-left-out", "experience", 2);
        addLoss(report, "left-out", "hidden-entries-left-out", "education", 1);
        expect(report.items).toEqual([
            { kind: "left-out", code: "hidden-entries-left-out", section: "experience", count: 3 },
            { kind: "left-out", code: "hidden-entries-left-out", section: "education", count: 1 },
        ]);
    });

    it("merges reports and filters by kind", () => {
        const a = emptyReport();
        const b = emptyReport();
        addLoss(a, "left-out", "photo-left-out", "basics", 1);
        addLoss(b, "changed", "skill-groups-flattened", "skills", 2);
        addLoss(b, "left-out", "photo-left-out", "basics", 1);
        const merged = mergeReports(a, b);
        expect(hasLosses(merged)).toBe(true);
        expect(hasLosses(emptyReport())).toBe(false);
        expect(itemsOfKind(merged, "left-out")).toEqual([{ kind: "left-out", code: "photo-left-out", section: "basics", count: 2 }]);
        expect(itemsOfKind(merged, "changed")).toHaveLength(1);
    });

    it("has a translation for every loss code in all five locales", () => {
        const locales = { en, de, bs, fr, es };
        const missing = Object.entries(locales).flatMap(([name, dictionary]) =>
            LOSS_CODES.filter((code) => !dictionary[`conversion.loss.${code}`]).map((code) => `${name}:${code}`));
        expect(missing).toEqual([]);
    });

    it("uses the same placeholders in every locale", () => {
        const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join(",");
        const locales = { de, bs, fr, es };
        const mismatched = Object.entries(locales).flatMap(([name, dictionary]) =>
            LOSS_CODES.filter((code) => placeholders(dictionary[`conversion.loss.${code}`]) !== placeholders(en[`conversion.loss.${code}`])).map((code) => `${name}:${code}`));
        expect(mismatched).toEqual([]);
    });
});
