import { describe, expect, it } from "vitest";
import { csvFromRows, zipFromEntries } from "./__fixtures__/archive-builder";
import { LinkedinImportError } from "./errors";
import { extractRecognizedEntries, isZipData } from "./zip";

const profileCsv = csvFromRows(["First Name"], [{ "First Name": "Amina" }]);
const skillsCsv = csvFromRows(["Name"], [{ Name: "TypeScript" }]);

describe("isZipData", () => {
    it("recognizes the ZIP local-file magic", () => {
        expect(isZipData(zipFromEntries({ "Profile.csv": profileCsv }))).toBe(true);
    });

    it("rejects non-ZIP bytes", () => {
        expect(isZipData(new TextEncoder().encode("plain text"))).toBe(false);
    });
});

describe("extractRecognizedEntries", () => {
    it("extracts recognized CSVs at the archive root", () => {
        const entries = extractRecognizedEntries(
            zipFromEntries({ "Profile.csv": profileCsv, "Skills.csv": skillsCsv }),
        );
        expect(Array.from(entries.keys()).sort()).toEqual(["profile", "skills"]);
        expect(entries.get("profile")).toBe(profileCsv);
    });

    it("tolerates folder prefixes in entry names", () => {
        const entries = extractRecognizedEntries(
            zipFromEntries({ "Basic_LinkedInDataExport_01-01-2026/Positions.csv": skillsCsv }),
        );
        expect(entries.has("positions")).toBe(true);
    });

    it("matches basenames case-insensitively", () => {
        const entries = extractRecognizedEntries(zipFromEntries({ "PROFILE.CSV": profileCsv }));
        expect(entries.has("profile")).toBe(true);
    });

    it("ignores unrecognized entries entirely", () => {
        const entries = extractRecognizedEntries(
            zipFromEntries({
                "Connections.csv": csvFromRows(["First Name"], []),
                "messages/Messages.csv": csvFromRows(["FROM"], []),
                "Profile.csv": profileCsv,
            }),
        );
        expect(Array.from(entries.keys())).toEqual(["profile"]);
    });

    it("returns an empty map for an archive with nothing recognized", () => {
        const entries = extractRecognizedEntries(
            zipFromEntries({ "Connections.csv": csvFromRows(["First Name"], []) }),
        );
        expect(entries.size).toBe(0);
    });

    it("throws corrupt-archive for mangled bytes with a ZIP magic", () => {
        const zipped = zipFromEntries({ "Profile.csv": profileCsv });
        const corrupted = zipped.slice(0, Math.floor(zipped.length / 2));
        expect(() => extractRecognizedEntries(corrupted)).toThrowError(LinkedinImportError);
        try {
            extractRecognizedEntries(corrupted);
        } catch (error) {
            expect((error as LinkedinImportError).failureClass).toBe("corrupt-archive");
        }
    });
});
