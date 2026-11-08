import { describe, expect, it } from "vitest";
import { createQaEdgeCaseResume, createQaFullResume, createQaMinimalResume } from "@/lib/qa/sample-resumes";
import { createEmptyResume, resumeSchema } from "@/lib/schema";
import { resumeToAuthoring, serializeAuthoring } from "./from-resume";
import { SENSITIVE_BASICS_FIELDS } from "./schema";

function walk(value: unknown, visit: (value: unknown, path: string) => void, path = "") {
    visit(value, path);
    if (Array.isArray(value)) value.forEach((item, index) => walk(item, visit, `${path}[${index}]`));
    else if (value && typeof value === "object") {
        for (const [key, item] of Object.entries(value)) walk(item, visit, path ? `${path}.${key}` : key);
    }
}

const INTERNAL_KEYS = ["settings", "customization", "aiHistory", "variants", "jobContext", "coverLetters", "meta", "photo", "photoEdit", "signature", "urlIcon", "skillGroups", "createdAt", "updatedAt", "version"];

describe("resumeToAuthoring", () => {
    it("writes no empty strings, arrays or objects and no hidden: false", () => {
        for (const resume of [createQaFullResume(), createQaEdgeCaseResume()]) {
            walk(resumeToAuthoring(resume, { ids: true, personal: true }), (value, path) => {
                // Layout-bearing exceptions: an empty skill group and an entries section with no entries.
                if (/^skills\[\d+]\.skills$|^custom\[\d+]\.(entries|tags)$/.test(path)) return;
                if (/^custom\[\d+]\.tags\[\d+]$/.test(path)) return;
                expect(value, path).not.toBe("");
                if (Array.isArray(value)) expect(value.length, path).toBeGreaterThan(0);
                if (path.endsWith(".hidden")) expect(value, path).toBe(true);
            });
        }
    });

    it("leaves out every internal and design field", () => {
        const keys: string[] = [];
        walk(resumeToAuthoring(createQaFullResume(), { ids: true, personal: true }), (_, path) => keys.push(path.split(".").pop()!.replace(/\[\d+]$/, "")));
        for (const key of INTERNAL_KEYS) expect(keys, key).not.toContain(key);
    });

    it("writes the minimal CV as format and name only", () => {
        expect(resumeToAuthoring(createQaMinimalResume())).toEqual({
            format: "enginecv.authoring/v1",
            basics: { name: "Minimal Person" },
        });
        expect(resumeToAuthoring(createEmptyResume())).toEqual({ format: "enginecv.authoring/v1" });
    });

    it("writes a flat skill list when only ungrouped skills exist", () => {
        const resume = resumeSchema.parse({
            skillGroups: [{ id: "ungrouped", name: "", skills: [{ name: "Go" }, { name: "Rust", level: "expert" }] }],
        });
        expect(resumeToAuthoring(resume).skills).toEqual(["Go", { name: "Rust", level: "expert" }]);
    });

    it("writes groups as an object, ungrouped skills under the empty key", () => {
        const resume = resumeSchema.parse({
            skillGroups: [
                { id: "ungrouped", name: "", skills: [{ name: "Git" }] },
                { name: "Frontend", skills: [{ name: "React" }] },
            ],
        });
        expect(resumeToAuthoring(resume).skills).toEqual({ "": ["Git"], Frontend: ["React"] });
    });

    it("falls back to a group list when a group is hidden", () => {
        const skills = resumeToAuthoring(createQaEdgeCaseResume()).skills as unknown[];
        expect(skills.slice(-2)).toEqual([
            { group: "Empty Group", skills: [] },
            { group: "QAHIDDEN Group", skills: ["QAHIDDEN Invisible"], hidden: true },
        ]);
    });

    it("writes languages as 'Language: level' unless they need detail", () => {
        const languages = resumeToAuthoring(createQaFullResume()).languages;
        expect(languages).toEqual([
            { language: "Bosnian", level: "Native", description: "Mother tongue." },
            {
                language: "English", level: "C2",
                certificate: { issuer: "Cambridge Assessment", id: "CPE-2014-8891", url: "https://cambridgeenglish.org/verify/CPE-2014-8891" },
                description: "Certificate of Proficiency in English.",
            },
            { language: "Deutsch", level: "B2", selfAssessed: true },
            { language: "日本語", level: "A2", description: "Conversational only." },
            { language: "QAHIDDEN Language", level: "C1", hidden: true },
        ]);
        const plain = resumeSchema.parse({ languages: [{ language: "German", fluency: "B2" }, { language: "Latin" }] });
        expect(resumeToAuthoring(plain).languages).toEqual(["German: B2", "Latin"]);
    });

    it("writes ids only when asked", () => {
        const resume = createQaFullResume();
        const idPaths: string[] = [];
        walk(resumeToAuthoring(resume), (_, path) => {
            if (path.endsWith(".id") && !path.endsWith(".certificate.id")) idPaths.push(path);
        });
        expect(idPaths).toEqual([]);
        const withIds = resumeToAuthoring(resume, { ids: true });
        expect(withIds.experience?.map((entry) => entry.id)).toEqual(["exp-1", "exp-2", "exp-3", "exp-hidden"]);
    });

    it("writes sensitive personal details only when asked", () => {
        const resume = createQaFullResume();
        const without = resumeToAuthoring(resume).basics as Record<string, unknown>;
        for (const field of SENSITIVE_BASICS_FIELDS) expect(without, field).not.toHaveProperty(field);
        expect(without).toMatchObject({ name: "Amina Šehić-Đurić", phone: "+387 60 000 000", nationality: "BA" });
        const withPersonal = resumeToAuthoring(resume, { personal: true }).basics as Record<string, unknown>;
        for (const field of SENSITIVE_BASICS_FIELDS) expect(withPersonal, field).toHaveProperty(field);
    });

    it("writes design hints only when they differ from the defaults", () => {
        // Built with parse, not by mutating createEmptyResume(): schema defaults are shared objects.
        const resume = resumeSchema.parse({ settings: { language: "de", colors: { accent: "#1f3a5f" } } });
        expect(resumeToAuthoring(resume).design).toEqual({ accent: "#1f3a5f", cvLanguage: "de" });
        expect(resumeToAuthoring(createEmptyResume()).design).toBeUndefined();
    });

    it("follows the CV's own section order", () => {
        const resume = resumeSchema.parse({
            experience: [{ position: "P" }],
            education: [{ institution: "U" }],
            settings: { layout: { sectionOrder: ["education", "experience"] } },
        });
        expect(Object.keys(resumeToAuthoring(resume))).toEqual(["format", "education", "experience"]);
    });

    it("is stable (QA full CV snapshot)", () => {
        expect(serializeAuthoring(resumeToAuthoring(createQaFullResume(), { ids: true, personal: true }), "pretty")).toMatchSnapshot();
    });
});
