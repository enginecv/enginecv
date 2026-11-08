import { describe, expect, it } from "vitest";
import { parseLinkedinDate } from "./dates";

describe("parseLinkedinDate", () => {
    it.each([
        ["Jan 2021", "2021-01"],
        ["Feb 2021", "2021-02"],
        ["Mar 2021", "2021-03"],
        ["Apr 2021", "2021-04"],
        ["May 2021", "2021-05"],
        ["Jun 2021", "2021-06"],
        ["Jul 2021", "2021-07"],
        ["Aug 2021", "2021-08"],
        ["Sep 2021", "2021-09"],
        ["Oct 2021", "2021-10"],
        ["Nov 2021", "2021-11"],
        ["Dec 2021", "2021-12"],
    ])("parses month-year %j to %j", (input, expected) => {
        expect(parseLinkedinDate(input)).toBe(expected);
    });

    it("parses a bare year", () => {
        expect(parseLinkedinDate("2021")).toBe("2021");
    });

    it("truncates full ISO dates to year-month", () => {
        expect(parseLinkedinDate("2021-03-15")).toBe("2021-03");
    });

    it.each([[""], ["   "], ["soon"], ["13 2021"], ["Januar 2021"], ["Jan"], ["Jan 21"]])(
        "maps unparseable %j to empty string",
        (input) => {
            expect(parseLinkedinDate(input)).toBe("");
        },
    );

    it("tolerates surrounding whitespace", () => {
        expect(parseLinkedinDate("  Sep 2020  ")).toBe("2020-09");
    });
});
