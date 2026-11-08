import { describe, expect, it } from "vitest";
import { QA_RESUME_FIXTURES } from "@/lib/qa/sample-resumes";
import { EXAMPLE_ROLES } from "@/lib/onboarding/examples";
import { resumeSchema, type Resume } from "@/lib/schema";
import { resumeToAuthoring } from "./from-resume";
import { LIST_SECTION_KEYS, SECTION_ENTRY_SPECS, type EntrySpec } from "./schema";
import { authoringToResume } from "./to-resume";
import { normaliseLink } from "./values";

/**
 * FR-008: every QA fixture survives resume → authoring → resume with all its
 * content. Deliberately NOT part of the format, so excluded here:
 *
 * - photos and signature images: `basics.photo`, `basics.photoEdit`, `declaration.signature`;
 * - presentation choices: every `urlIcon`/`issuerUrlIcon`, skill `icon`/`display`,
 *   custom link `icon`, custom section `icon`, project `icon`, `basics.detailsOrder`
 *   and `basics.passportOrId` (which of passport/ID the header shows);
 * - everything outside content: settings, customization, meta, aiHistory,
 *   variants, jobContext, coverLetters, timestamps;
 * - ids of nested items that are not entries (emails, custom links, repos) and
 *   of skill groups; entries written as plain strings (skills, languages,
 *   interests) get fresh ids;
 * - a custom section keeps only the field its layout shows (text, tags or entries).
 *
 * Scheme-less links gain `https://` on import by design; the comparison
 * applies the same normalisation.
 */

const ENTRY_EXCLUDED = new Set(["urlIcon", "issuerUrlIcon", "icon", "display", "signature"]);

type Obj = Record<string, unknown>;

const date = (value: unknown) => (typeof value === "string" ? value : "");
const link = (value: unknown) => normaliseLink(typeof value === "string" ? value : "").value;

function entryContent(entry: Obj, spec: EntrySpec, withIds: boolean): Obj {
    const out: Obj = {};
    for (const [name, field] of Object.entries(spec.fields)) {
        if (name === "id") {
            if (withIds) out.id = entry.id;
        } else if (field.kind === "date") {
            out[name] = date(entry[name]);
        } else if (field.kind === "link") {
            out[name] = link(entry[name]);
        } else if (field.kind === "repos") {
            out[name] = (entry[name] as Obj[]).map(({ url, label, platform }) => ({ url, label, platform }));
        } else {
            out[name] = entry[name];
        }
    }
    return out;
}

function content(resume: Resume, withIds: boolean) {
    const { photo, photoEdit, detailsOrder, passportOrId, emails, customLinks, ...basics } = resume.basics;
    void photo; void photoEdit; void detailsOrder; void passportOrId;
    return {
        basics: {
            ...basics,
            website: link(basics.website),
            linkedin: link(basics.linkedin),
            github: link(basics.github),
            emails: emails.map(({ email, label }) => ({ email, label })),
            customLinks: customLinks.map(({ name, url, label }) => ({ name, url: link(url), label })),
        },
        ...Object.fromEntries(LIST_SECTION_KEYS.map((key) => [
            key,
            (resume[key] as unknown as Obj[]).map((entry) => entryContent(entry, SECTION_ENTRY_SPECS[key], withIds)),
        ])),
        declaration: resume.declaration.map((entry) =>
            entryContent(entry as unknown as Obj, SECTION_ENTRY_SPECS.declaration, withIds)),
        skillGroups: resume.skillGroups.map((group) => ({
            name: group.name,
            hidden: group.hidden,
            skills: group.skills.map(({ name, level, description, keywords, hidden }) =>
                ({ name, level, description, keywords, hidden })),
        })),
        languages: resume.languages.map(({ id, cefr, cefrDetailed, ...language }) => {
            void id;
            return { ...language, cefrDetailed, cefr: cefrDetailed ? cefr : null };
        }),
        interests: resume.interests.map(({ name, description, hidden }) => ({ name, description, hidden })),
        customSections: resume.customSections.map((section) => ({
            ...(withIds ? { id: section.id } : {}),
            title: section.title,
            hidden: section.hidden,
            layout: section.layout,
            body: section.layout === "entries"
                ? section.entries.map((entry) =>
                    entryContent(entry as unknown as Obj, SECTION_ENTRY_SPECS.customEntry, withIds))
                : section.layout === "tags" ? section.tags : section.text,
        })),
    };
}

describe("authoring round trip (FR-008)", () => {
    for (const fixture of QA_RESUME_FIXTURES) {
        it(`${fixture.id}: keeps every content field and every entry id`, () => {
            const original = fixture.create();
            const back = authoringToResume(resumeToAuthoring(original, { ids: true, personal: true })).resume;
            expect(content(back, true)).toEqual(content(original, true));
        });

        it(`${fixture.id}: keeps every content field without ids`, () => {
            const original = fixture.create();
            const back = authoringToResume(resumeToAuthoring(original, { ids: false, personal: true })).resume;
            expect(content(back, false)).toEqual(content(original, false));
            const originalIds = new Set(original.experience.map((entry) => entry.id));
            expect(back.experience.every((entry) => !originalIds.has(entry.id))).toBe(true);
        });

        it(`${fixture.id}: the result is a valid resume with the sections listed`, () => {
            const back = authoringToResume(resumeToAuthoring(fixture.create(), { ids: true, personal: true })).resume;
            for (const key of back.settings.contentSections) {
                expect(back.settings.layout.sectionOrder).toContain(key);
            }
        });
    }

    // Real-world shapes: the examples keep their skills in an unnamed group of their own.
    for (const role of EXAMPLE_ROLES) {
        it(`example "${role.id}": keeps every content field`, async () => {
            const original = resumeSchema.parse((await role.load()).en());
            const back = authoringToResume(resumeToAuthoring(original, { personal: true })).resume;
            expect(content(back, false)).toEqual(content(original, false));
        });
    }

    it("the format covers every stored entry field except the documented exclusions", () => {
        const resume = QA_RESUME_FIXTURES[0].create();
        const check = (entries: Obj[], spec: EntrySpec) => {
            for (const entry of entries) {
                for (const key of Object.keys(entry)) {
                    if (ENTRY_EXCLUDED.has(key)) continue;
                    expect(spec.fields, `field "${key}"`).toHaveProperty(key);
                }
            }
        };
        for (const key of LIST_SECTION_KEYS) check(resume[key] as unknown as Obj[], SECTION_ENTRY_SPECS[key]);
        check(resume.declaration as unknown as Obj[], SECTION_ENTRY_SPECS.declaration);
        check(resume.interests as unknown as Obj[], SECTION_ENTRY_SPECS.interests);
        check(resume.skillGroups.flatMap((group) => group.skills) as unknown as Obj[], SECTION_ENTRY_SPECS.skill);
        check(resume.customSections.flatMap((section) => section.entries) as unknown as Obj[], SECTION_ENTRY_SPECS.customEntry);
    });
});
