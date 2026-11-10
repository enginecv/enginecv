import { describe, expect, it } from "vitest";
import { exportDate, importDate } from "./dates";

describe("importDate", () => {
    it("reads the three JSON Resume precisions", () => {
        expect(importDate("2019")).toEqual({ value: "2019", dayDropped: false, unreadable: false });
        expect(importDate("2019-06")).toEqual({ value: "2019-06", dayDropped: false, unreadable: false });
        expect(importDate("2019-06-15")).toEqual({ value: "2019-06", dayDropped: true, unreadable: false });
    });

    it("treats empty and non-text input as no date", () => {
        for (const input of [undefined, null, "", "   ", 5, {}]) {
            expect(importDate(input)).toEqual({ value: "", dayDropped: false, unreadable: false });
        }
    });

    it("reads human dates and flags what it cannot read", () => {
        expect(importDate("June 2019").value).toBe("2019-06");
        expect(importDate("garbage")).toEqual({ value: "", dayDropped: false, unreadable: true });
    });

    it("keeps only the year when the month is out of range", () => {
        expect(importDate("2019-13").value).toBe("2019");
    });
});

describe("exportDate", () => {
    it("writes the stored precisions", () => {
        expect(exportDate("2019-06").value).toBe("2019-06");
        expect(exportDate("2019").value).toBe("2019");
    });

    it("leaves the field out for a current role", () => {
        expect(exportDate("Present")).toEqual({ value: undefined, unparsed: false, current: true });
    });

    it("leaves the field out for no date", () => {
        expect(exportDate(undefined)).toEqual({ value: undefined, unparsed: false, current: false });
        expect(exportDate("")).toEqual({ value: undefined, unparsed: false, current: false });
    });

    it("normalises readable text and reports the rest", () => {
        expect(exportDate("June 2019").value).toBe("2019-06");
        expect(exportDate("sometime")).toEqual({ value: undefined, unparsed: true, current: false });
    });
});
