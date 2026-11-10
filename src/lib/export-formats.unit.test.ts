import { describe, expect, it } from "vitest";
import { en } from "./i18n/en";
import { clientPreferencesSchema } from "./preferences/schema";
import {
    EXPORT_FORMAT_IDS,
    EXPORT_FORMATS,
    getExportFormat,
    getExportFormatCount,
    getExportFormatLabels,
    isResumeExportFormat,
} from "./export-formats";

describe("export format registry", () => {
    it("declares every id exactly once with a unique extension", () => {
        const ids = EXPORT_FORMATS.map((format) => format.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect([...ids].sort()).toEqual([...EXPORT_FORMAT_IDS].sort());
        const extensions = EXPORT_FORMATS.map((format) => format.extension);
        expect(new Set(extensions).size).toBe(extensions.length);
    });

    it("limits encryption to json and pdf, and the photo option to docx and JSON Resume", () => {
        expect(EXPORT_FORMATS.filter((format) => format.supportsEncryption).map((format) => format.id).sort()).toEqual(["json", "pdf"]);
        expect(EXPORT_FORMATS.filter((format) => format.options.includes("photo")).map((format) => format.id).sort()).toEqual(["docx", "jsonresume"]);
    });

    it("marks only JSON Resume as lossy", () => {
        expect(EXPORT_FORMATS.filter((format) => format.lossy).map((format) => format.id)).toEqual(["jsonresume"]);
    });

    it("references copy that exists in the English dictionary", () => {
        const dictionary = en as Record<string, string>;
        for (const format of EXPORT_FORMATS) {
            expect(dictionary[format.labelKey], format.labelKey).toBeTruthy();
            expect(dictionary[format.descriptionKey], format.descriptionKey).toBeTruthy();
        }
    });

    it("falls back to pdf for a stored format that no longer exists", () => {
        const parsed = clientPreferencesSchema.parse({ export: { format: "retired-format", pdfIncludeSidecar: true } });
        expect(parsed.export).toEqual({ format: "pdf", pdfIncludeSidecar: true, docxIncludePhoto: false });
    });

    it("guards unknown values", () => {
        expect(isResumeExportFormat("docx")).toBe(true);
        expect(isResumeExportFormat("encrypted-json")).toBe(false);
        expect(isResumeExportFormat(undefined)).toBe(false);
        expect(getExportFormat("md").extension).toBe("md");
    });

    it("exposes the format count and names for public copy", () => {
        const dictionary = en as Record<string, string>;
        expect(getExportFormatCount()).toBe(EXPORT_FORMATS.length);
        const labels = getExportFormatLabels((key) => dictionary[key]);
        expect(labels.split(", ")).toHaveLength(getExportFormatCount());
        expect(labels.startsWith("JSON, JSON Resume, PDF")).toBe(true);
    });
});
