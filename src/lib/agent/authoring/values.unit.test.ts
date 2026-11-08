import { describe, expect, it } from "vitest";
import {
    formatHumanDate,
    MONTH_LOOKUP,
    MONTH_NAMES,
    normaliseLink,
    normaliseSkillLevel,
    parseHumanDate,
    parseLanguageLevel,
    parseLanguageString,
    parseSkillString,
    PRESENT_WORDS,
} from "./values";

describe("parseHumanDate", () => {
    it.each(["2021", "2021-03", "2021-03-17"])("keeps the canonical form %s without a notice", (value) => {
        expect(parseHumanDate(value)).toEqual({ value });
    });

    it.each(["present", "Present", "PRESENT"])("reads %s as the stored ongoing value", (value) => {
        const result = parseHumanDate(value);
        expect(result.value).toBe("Present");
    });

    it("keeps 'present' and the stored 'Present' without a notice", () => {
        expect(parseHumanDate("present").issue).toBeUndefined();
        expect(parseHumanDate("Present").issue).toBeUndefined();
    });

    it.each([
        ["03/2021", "2021-03"],
        ["3/2021", "2021-03"],
        ["03.2021", "2021-03"],
        ["2021/03", "2021-03"],
        ["2021-3", "2021-03"],
        ["March 2021", "2021-03"],
        ["Mar 2021", "2021-03"],
        ["Sept. 2020", "2020-09"],
        ["März 2021", "2021-03"],
        ["Dez 2019", "2019-12"],
        ["mart 2021", "2021-03"],
        ["septembar 2018", "2018-09"],
        ["mars 2021", "2021-03"],
        ["août 2017", "2017-08"],
        ["déc. 2016", "2016-12"],
        ["marzo 2021", "2021-03"],
        ["dic 2015", "2015-12"],
    ])("normalises %s to %s with a notice", (input, expected) => {
        const result = parseHumanDate(input);
        expect(result.value).toBe(expected);
        expect(result.issue).toMatchObject({ kind: "adjusted", code: "date-normalised", params: { value: input } });
    });

    it.each(["current", "ongoing", "heute", "bis heute", "aktuell", "danas", "trenutno", "aujourd'hui", "aujourd’hui", "en cours", "actualidad", "presente"])(
        "reads the present word %s as ongoing, with a notice",
        (word) => {
            const result = parseHumanDate(word);
            expect(result.value).toBe("Present");
            expect(result.issue?.code).toBe("date-normalised");
        },
    );

    it.each(["spring 2021", "Q3 2020", "13/2021", "2021-13", "soon", "17.08.2026"])("drops %s and reports it", (value) => {
        expect(parseHumanDate(value)).toEqual({
            value: "",
            issue: { kind: "skipped", code: "date-unparsed", params: { value } },
        });
    });

    it("treats an empty date as no date", () => {
        expect(parseHumanDate("  ")).toEqual({ value: "" });
    });

    it("has no month name that means two months, and no present word that is a month", () => {
        const names = MONTH_NAMES.flat();
        expect(new Set(names).size).toBe(names.length);
        expect(MONTH_LOOKUP.size).toBe(names.length);
        expect(PRESENT_WORDS.filter((word) => MONTH_LOOKUP.has(word))).toEqual([]);
    });
});

describe("formatHumanDate", () => {
    it("round-trips ongoing, empty and canonical dates", () => {
        expect(formatHumanDate("Present")).toBe("present");
        expect(parseHumanDate(formatHumanDate("Present")!).value).toBe("Present");
        expect(formatHumanDate("")).toBeUndefined();
        expect(formatHumanDate(undefined)).toBeUndefined();
        expect(formatHumanDate("2021-03")).toBe("2021-03");
    });
});

describe("languages", () => {
    it("reads the canonical 'Language: level' form without a notice", () => {
        expect(parseLanguageString("German: B2")).toEqual({ value: { language: "German", fluency: "B2" } });
        expect(parseLanguageString("Bosnian: Native")).toEqual({ value: { language: "Bosnian", fluency: "Native" } });
        expect(parseLanguageString("Japanese")).toEqual({ value: { language: "Japanese", fluency: "" } });
    });

    it("stores 'native' as Native", () => {
        expect(parseLanguageString("German: native").value.fluency).toBe("Native");
    });

    it.each([
        ["German (C1)", "German", "C1"],
        ["Deutsch – Muttersprache", "Deutsch", "Native"],
        ["Bosanski - maternji jezik", "Bosanski", "Native"],
        ["Français — langue maternelle", "Français", "Native"],
    ])("normalises %s", (input, language, fluency) => {
        const result = parseLanguageString(input);
        expect(result.value).toEqual({ language, fluency });
        expect(result.issue?.code).toBe("language-normalised");
    });

    it("upper-cases CEFR codes with a notice", () => {
        expect(parseLanguageLevel("b2")).toMatchObject({ value: "B2", issue: { code: "language-normalised" } });
        expect(parseLanguageLevel("C1")).toEqual({ value: "C1" });
    });

    it("keeps native-or-bilingual wording the app already understands", () => {
        expect(parseLanguageLevel("Native or bilingual proficiency")).toEqual({ value: "Native or bilingual proficiency" });
    });

    it("keeps unknown levels as text and flags them for review", () => {
        expect(parseLanguageLevel("fluent")).toEqual({
            value: "fluent",
            issue: { kind: "review", code: "language-level-unrecognised", params: { value: "fluent" } },
        });
    });
});

describe("skills", () => {
    it("splits a known level out of brackets", () => {
        expect(parseSkillString("TypeScript (expert)")).toMatchObject({
            value: { name: "TypeScript", level: "expert" },
            issue: { code: "skill-normalised" },
        });
        expect(parseSkillString("React (fortgeschritten)").value).toEqual({ name: "React", level: "proficient" });
        expect(parseSkillString("SQL (intermédiaire)").value).toEqual({ name: "SQL", level: "competent" });
        expect(parseSkillString("Go (básico)").value).toEqual({ name: "Go", level: "beginner" });
        expect(parseSkillString("Docker (napredno)").value).toEqual({ name: "Docker", level: "proficient" });
    });

    it("leaves other brackets in the name", () => {
        expect(parseSkillString("C++ (17/20)")).toEqual({ value: { name: "C++ (17/20)", level: "" } });
        expect(parseSkillString("Rust")).toEqual({ value: { name: "Rust", level: "" } });
    });

    it("normalises level synonyms and drops unknown levels", () => {
        expect(normaliseSkillLevel("expert")).toEqual({ value: "expert" });
        expect(normaliseSkillLevel("Advanced")).toMatchObject({ value: "proficient", issue: { code: "skill-normalised" } });
        expect(normaliseSkillLevel("9/10")).toEqual({
            value: "",
            issue: { kind: "skipped", code: "skill-level-unknown", params: { value: "9/10" } },
        });
    });
});

describe("normaliseLink", () => {
    it("adds https to bare domains", () => {
        expect(normaliseLink("github.com/x")).toEqual({
            value: "https://github.com/x",
            issue: { kind: "adjusted", code: "link-normalised", params: { value: "github.com/x", result: "https://github.com/x" } },
        });
        expect(normaliseLink("www.example.com").value).toBe("https://www.example.com");
    });

    it("leaves links with a scheme, emails, phones and handles alone", () => {
        for (const value of ["https://a.example", "mailto:a@b.example", "a@b.example", "+387 61 000 000", "@amina", ""]) {
            expect(normaliseLink(value)).toEqual({ value });
        }
    });
});
