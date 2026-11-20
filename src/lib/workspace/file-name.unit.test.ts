import { describe, expect, it } from "vitest";
import { fileStemToTitle, sanitizeFileStem, suggestedFileName } from "./file-name";

describe("sanitizeFileStem", () => {
    it("removes illegal and control characters", () => {
        expect(sanitizeFileStem('a/b\\c:d*e?f"g<h>i|j\u0001k')).toBe("abcdefghijk");
    });
    it("trims dots and spaces", () => {
        expect(sanitizeFileStem("  ..My CV.. ")).toBe("My CV");
    });
    it("caps the length at 100", () => {
        expect(sanitizeFileStem("a".repeat(300))).toHaveLength(100);
    });
    it("falls back to resume", () => {
        expect(sanitizeFileStem("")).toBe("resume");
        expect(sanitizeFileStem("???")).toBe("resume");
        expect(sanitizeFileStem("CON")).toBe("resume");
    });
    it("keeps non-latin names", () => {
        expect(sanitizeFileStem("Životopis Amina")).toBe("Životopis Amina");
    });
});

describe("suggestedFileName / fileStemToTitle", () => {
    it("adds the extension", () => {
        expect(suggestedFileName("My CV")).toBe("My CV.enginecv.json");
    });
    it("strips .enginecv.json then .json", () => {
        expect(fileStemToTitle("My CV.enginecv.json")).toBe("My CV");
        expect(fileStemToTitle("My CV.JSON")).toBe("My CV");
        expect(fileStemToTitle("notes.txt")).toBe("notes.txt");
    });
});
