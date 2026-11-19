import { encode } from "gpt-tokenizer/encoding/o200k_base";
import { describe, expect, it } from "vitest";
import { sectionCounts } from "@/lib/linked-file/apply-content";
import { makeWorkspaceCv } from "../../../test/setup/workspace-fixtures";
import { AGENTS_FILE, agentsMarkdown, exportsReference, machineGitignore, readmeMarkdown, workspaceJson } from "./agent-files";
import { buildIndex, indexText } from "./index-file";

const tokens = (text: string) => encode(text).length;
const now = Date.UTC(2026, 10, 19, 12, 0, 0);
const uuid = (n: number) => `${String(n).padStart(8, "0")}-1b2c-4d3e-8f4a-5b6c7d8e9f0a`;

describe("workspace index", () => {
    const cv = makeWorkspaceCv({ id: uuid(1), title: "Master CV", name: "Amina Hodzic" });
    const index = buildIndex({
        cvs: [{ id: uuid(1), fileName: "master-cv.cv.json", title: "Master CV", language: "en", updatedAt: now - 60_000, entries: sectionCounts(cv) }],
        letters: [{ id: uuid(2), fileName: "acme.letter.json", cvId: uuid(1), company: "Acme", role: "Designer", status: "draft", updatedAt: now - 30_000 }],
        states: new Map(),
        now,
    });

    it("lists documents with ids, files, links, sizes and states, newest first", () => {
        expect(index.format).toBe("enginecv.index/v1");
        expect(index.cvs[0]).toMatchObject({ id: uuid(1), file: "cvs/master-cv.cv.json", lang: "en" });
        expect(index.cvs[0].state).toBeUndefined(); // in sync: nothing to say
        expect(Object.keys(index.cvs[0].entries).length).toBeGreaterThan(3);
        expect(index.letters[0]).toMatchObject({ file: "letters/acme.letter.json", cv: uuid(1), status: "draft" });
        expect(index.updated).toBe("2026-11-19T12:00:00Z");
    });

    it("never carries contact details or document text", () => {
        const text = indexText(index);
        for (const secret of ["amina@example.com", "+49 30 1234567", "Berlin", "Hodzic"]) expect(text).not.toContain(secret);
    });

    it("reports a blocked document with its reason code, and nothing else", () => {
        const blocked = buildIndex({
            cvs: [{ id: "cv-1", fileName: "a.cv.json", title: "A", language: "en", updatedAt: now, entries: {} }],
            letters: [],
            states: new Map([["cv-1", { state: "blocked", reason: { code: "cut-off", line: 3, detail: "secret text" } }]]),
            now,
        });
        expect(blocked.cvs[0]).toMatchObject({ state: "blocked", reason: "cut-off" });
        expect(indexText(blocked)).not.toContain("secret text");
    });

    it("stays within the token budget: 250 for a CV and letter pair, then 100 per extra CV and 70 per extra letter", () => {
        expect(tokens(indexText(index))).toBeLessThanOrEqual(250);
        const many = buildIndex({
            cvs: Array.from({ length: 5 }, (_, i) => ({ id: uuid(10 + i), fileName: `cv-${i}.cv.json`, title: `CV ${i}`, language: "en", updatedAt: now - i, entries: { experience: 3, education: 2, skills: 12, projects: 4 } })),
            letters: Array.from({ length: 10 }, (_, i) => ({ id: uuid(30 + i), fileName: `l-${i}.letter.json`, cvId: uuid(10), company: `Co ${i}`, role: "Designer", status: "draft" as const, updatedAt: now - i })),
            states: new Map(),
            now,
        });
        expect(tokens(indexText(many))).toBeLessThanOrEqual(250 + 4 * 100 + 9 * 70);
    });

    it("clips very long titles", () => {
        const long = buildIndex({ cvs: [{ id: "x", fileName: "x.cv.json", title: "t".repeat(500), language: "en", updatedAt: now, entries: {} }], letters: [], states: new Map(), now });
        expect(long.cvs[0].title.length).toBeLessThanOrEqual(60);
    });
});

describe("generated agent files", () => {
    it("keeps the instruction file within about 300 tokens", () => {
        expect(tokens(agentsMarkdown())).toBeLessThanOrEqual(320);
        expect(AGENTS_FILE).toBe("AGENTS.md");
    });

    it("keeps the exports reference within 1,500 tokens and gives a command for every system", () => {
        const text = exportsReference();
        expect(tokens(text)).toBeLessThanOrEqual(1500);
        for (const needle of ["chrome.exe", "Google Chrome.app", "google-chrome", "has not changed for 1 second"]) expect(text).toContain(needle);
    });

    it("points an agent at the index first and states the safety rules", () => {
        const text = agentsMarkdown();
        expect(text).toContain(".enginecv/index.json");
        expect(text).toMatch(/whole file in one write/);
        expect(text).toMatch(/"status": "sent"/);
        expect(text).toMatch(/results\//);
    });

    it("contains no personal data and no document text", () => {
        for (const text of [agentsMarkdown(), readmeMarkdown(), workspaceJson({ id: "w", createdAt: now, appVersion: "1.0.0", hideContact: false })]) {
            expect(text).not.toMatch(/@\w+\./);
        }
    });

    it("writes workspace.json and a gitignore for the noisy machine files", () => {
        expect(JSON.parse(workspaceJson({ id: "w1", createdAt: now, appVersion: "1.0.0", hideContact: true }))).toMatchObject({ format: "enginecv.workspace/v1", id: "w1", hideContact: true });
        expect(machineGitignore().split("\n")).toEqual(expect.arrayContaining(["requests/", "results/", "conflicts/", "log.ndjson"]));
    });
});
