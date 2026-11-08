import { describe, expect, it } from "vitest";
import { CsvParseError, parseCsv } from "./csv";

describe("parseCsv", () => {
    it("maps rows to header-keyed records", () => {
        const parsed = parseCsv("Name,Level\r\nTypeScript,expert\r\nReact,advanced\r\n");
        expect(parsed.headers).toEqual(["Name", "Level"]);
        expect(parsed.rows).toEqual([
            { Name: "TypeScript", Level: "expert" },
            { Name: "React", Level: "advanced" },
        ]);
    });

    it("handles quoted commas", () => {
        const parsed = parseCsv('City\n"Sarajevo, Bosnia"\n');
        expect(parsed.rows[0].City).toBe("Sarajevo, Bosnia");
    });

    it("handles quoted embedded newlines", () => {
        const parsed = parseCsv('Description\n"line one\nline two"\n');
        expect(parsed.rows).toHaveLength(1);
        expect(parsed.rows[0].Description).toBe("line one\nline two");
    });

    it('unescapes doubled quotes ("")', () => {
        const parsed = parseCsv('Quote\n"She said ""hi"""\n');
        expect(parsed.rows[0].Quote).toBe('She said "hi"');
    });

    it("accepts LF-only line endings", () => {
        const parsed = parseCsv("A,B\n1,2\n3,4");
        expect(parsed.rows).toEqual([
            { A: "1", B: "2" },
            { A: "3", B: "4" },
        ]);
    });

    it("strips a UTF-8 BOM before the header row", () => {
        const parsed = parseCsv("﻿Name\nAmina\n");
        expect(parsed.headers).toEqual(["Name"]);
        expect(parsed.rows[0].Name).toBe("Amina");
    });

    it("pads short rows with empty strings", () => {
        const parsed = parseCsv("A,B,C\n1,2\n");
        expect(parsed.rows[0]).toEqual({ A: "1", B: "2", C: "" });
    });

    it("drops extra cells beyond the header width", () => {
        const parsed = parseCsv("A,B\n1,2,3,4\n");
        expect(parsed.rows[0]).toEqual({ A: "1", B: "2" });
    });

    it("skips blank trailing lines", () => {
        const parsed = parseCsv("A\n1\n\n\n");
        expect(parsed.rows).toEqual([{ A: "1" }]);
    });

    it("throws CsvParseError on an unterminated quote at EOF", () => {
        expect(() => parseCsv('A\n"unterminated\n')).toThrow(CsvParseError);
    });

    it("keeps quoted CRLF inside a field as-is", () => {
        const parsed = parseCsv('D\r\n"a\r\nb"\r\n');
        expect(parsed.rows[0].D).toBe("a\r\nb");
    });
});
