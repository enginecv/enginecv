import { describe, expect, it } from "vitest";
import full from "@/lib/__fixtures__/json-resume/full.json";
import { resumeToJsonResume } from "./from-resume";
import { jsonResumeToResume } from "./to-resume";

type Doc = Record<string, unknown>;

/** The part of a JSON Resume document both formats can hold, so a round trip must keep it. */
function holdable(document: Doc): Doc {
    const copy = JSON.parse(JSON.stringify(document)) as Doc;
    const basics = copy.basics as Doc;
    delete basics.image; // a web address is not fetched
    const work = (copy.work as Doc[]).map((entry) => {
        const { description: _company, startDate, ...rest } = entry; // company blurb has no home
        void _company;
        return { ...rest, startDate: typeof startDate === "string" ? startDate.slice(0, 7) : startDate };
    });
    copy.work = work;
    // Interest keywords and project roles/type fold or drop on the way in.
    copy.interests = (copy.interests as Doc[]).map(({ name }) => ({ name }));
    copy.projects = (copy.projects as Doc[]).map(({ roles: _r, type: _t, ...rest }) => {
        void _r;
        void _t;
        return rest;
    });
    copy.publications = (copy.publications as Doc[]).map((entry) => ({ ...entry, releaseDate: String(entry.releaseDate).slice(0, 7) }));
    // Free-text levels are mapped onto the five EngineCV levels; an unknown word stays in the description.
    const levelWords: Record<string, string> = { Master: "Expert", Intermediate: "Competent" };
    copy.skills = (copy.skills as Doc[]).map((skill) => {
        if (skill.name === "Distributed systems") return { name: skill.name };
        return { ...skill, level: levelWords[skill.level as string] ?? skill.level };
    });
    copy.languages = (copy.languages as Doc[]).map((language) =>
        language.language === "English" ? { language: "English", fluency: "Native" } : language);
    for (const key of ["meta", "x-custom", "$schema"]) delete copy[key];
    return copy;
}

function strip(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(strip);
    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value).filter(([, entry]) => entry !== "" && !(Array.isArray(entry) && entry.length === 0)).map(([key, entry]) => [key, strip(entry)]),
        );
    }
    return value;
}

describe("JSON Resume round trip", () => {
    it("keeps every field both formats can hold", () => {
        const imported = jsonResumeToResume(full);
        const exported = resumeToJsonResume(imported.resume).document;
        delete exported.meta;
        delete exported.$schema;
        const expected = strip(holdable(full as unknown as Doc)) as Doc;
        const actual = strip(exported) as Doc;

        // Location text is built from the parts; the parts themselves must survive.
        expect((actual.basics as Doc).location).toEqual((expected.basics as Doc).location);
        expect(actual).toEqual(expected);
    });

    it("lists on export only what it also warned about, and import losses it named", () => {
        const imported = jsonResumeToResume(full);
        const exported = resumeToJsonResume(imported.resume);
        const importCodes = imported.report.items.map((entry) => entry.code);
        // The photo address was reported on import, so there is no photo for export to lose.
        expect(importCodes).toContain("photo-url-not-fetched");
        expect(exported.report.items.map((entry) => entry.code)).not.toContain("photo-left-out");
    });
});
