import { encode } from "gpt-tokenizer/encoding/o200k_base";
import { describe, expect, it } from "vitest";
import { createQaFullResume } from "@/lib/qa/sample-resumes";
import { sectionCounts } from "@/lib/linked-file/apply-content";
import { LETTER_SCHEMA_URL, letterFileSchema } from "@/lib/letters/file-format";
import { AUTHORING_FORMAT } from "@/lib/agent/authoring/schema";
import { makeLetter } from "../../../test/setup/letter-fixtures";
import { agentsMarkdown, cvFormatReference, exportsReference, isUntouched, letterFormatReference, recipesReference, referenceFiles } from "./agent-files";
import { createCvCodec } from "./codecs/cv";
import { buildIndex, indexText } from "./index-file";

const tokens = (text: string) => encode(text).length;

/** Fixed UUID-shaped ids, so the measured sizes do not wobble with random ids. */
let counter = 0;
const createId = () => `${(0x3a7f1c00 + 0x1b3d5f * ++counter).toString(16).padStart(8, "0")}-9c4e-4b2a-a6d1-${(0x5e8b2d4a7c10 + 0x3b9d * counter).toString(16)}`;
const now = Date.UTC(2026, 10, 19, 12, 0, 0);

/** Real-looking ids: they are UUIDs in the app and cost most of an index. */
const cv = (n: number) => ({ id: createId(), fileName: `cv-${n}.cv.json`, title: `Master CV ${n}`, language: "en", updatedAt: now - n * 1000, entries: sectionCounts(createQaFullResume()) });
const letter = (n: number, cvId: string) => ({ id: createId(), fileName: `acme-${n}.letter.json`, cvId, company: "Acme", role: "Product Designer", status: "draft" as const, updatedAt: now - n * 1000 });

describe("agent file budgets (o200k_base)", () => {
    it("keeps the instruction file within 320 tokens", () => {
        expect(tokens(agentsMarkdown())).toBeLessThanOrEqual(320);
    });

    it("keeps each reference within 1,500 tokens", () => {
        const sizes = Object.fromEntries(Object.entries(referenceFiles()).map(([name, text]) => [name, tokens(text)]));
        for (const [name, size] of Object.entries(sizes)) expect(size, name).toBeLessThanOrEqual(1500);
        expect(Object.keys(sizes).sort()).toEqual(["cv-format.md", "exports.md", "letter-format.md", "recipes.md"]);
    });

    it("keeps the index at 250 tokens for one CV and one letter, then about 170 per extra CV with every section filled and 80 per extra letter (a letter carries its file, the CV id it follows, company and role)", () => {
        const first = createId();
        const one = tokens(indexText(buildIndex({ cvs: [{ ...cv(1), id: first }], letters: [letter(1, first)], states: new Map(), now })));
        expect(one).toBeLessThanOrEqual(250);
        const extraCvs = tokens(indexText(buildIndex({ cvs: [{ ...cv(1), id: first }, cv(2), cv(3), cv(4)], letters: [letter(1, first)], states: new Map(), now }))) - one;
        expect(extraCvs / 3).toBeLessThanOrEqual(170); // the QA CV fills all 14 sections: a worst case
        const extraLetters = tokens(indexText(buildIndex({ cvs: [{ ...cv(1), id: first }], letters: [letter(1, first), letter(2, first), letter(3, first)], states: new Map(), now }))) - one;
        expect(extraLetters / 2).toBeLessThanOrEqual(80);
    });

    it("lets an agent add two projects for under 1,000 tokens: instructions, index, the last project for style, and the edit", () => {
        const full = createQaFullResume();
        const text = createCvCodec().serialize({ ...full, id: createId() }, { hideContact: false });
        const list = (JSON.parse(text) as { projects: unknown[] }).projects;
        const lastProject = JSON.stringify(list[list.length - 1], null, 2);
        const id = createId();
        const index = indexText(buildIndex({ cvs: [{ ...cv(1), id }], letters: [letter(1, id)], states: new Map(), now }));
        const edit = JSON.stringify([{ name: "Open-source CLI", description: "A small command line tool for ...", url: "https://example.com/cli", skills: ["Rust"] }, { name: "Design system", description: "Shared components used by three teams.", skills: ["TypeScript", "Figma"] }], null, 2);
        const lean = tokens(agentsMarkdown()) + tokens(index) + tokens(lastProject) + tokens(edit);
        expect(lean).toBeLessThanOrEqual(1000);
        // Reading the whole section first (a careful but wasteful agent) still stays near a thousand.
        const wholeSection = tokens(agentsMarkdown()) + tokens(index) + tokens(JSON.stringify(list, null, 2)) + tokens(edit);
        expect(wholeSection).toBeLessThanOrEqual(1250);
    });

    it("hashes every generated file so an edit can be told from an old copy", () => {
        for (const text of [agentsMarkdown(), cvFormatReference(), letterFormatReference(), exportsReference(), recipesReference()]) {
            expect(isUntouched(text)).toBe(true);
            expect(isUntouched(`${text}\nextra line`)).toBe(false);
        }
    });

    it("documents every field of both file formats", () => {
        const letterText = letterFormatReference();
        for (const key of Object.keys(letterFileSchema.shape).filter((name) => name !== "$schema" && name !== "format")) expect(letterText, `letter field ${key}`).toContain(`\`${key}\``);
        expect(letterText).toContain(LETTER_SCHEMA_URL);
        const cvText = cvFormatReference();
        expect(cvText).toContain(AUTHORING_FORMAT);
        for (const section of ["basics", "experience", "education", "projects", "skills", "languages", "custom"]) expect(cvText, `cv section ${section}`).toContain(section);
    });

    it("never contains contact details or document text", () => {
        for (const text of [agentsMarkdown(), ...Object.values(referenceFiles())]) {
            expect(text).not.toMatch(/amina@example\.com|\+49 30/);
        }
        void makeLetter;
    });
});
