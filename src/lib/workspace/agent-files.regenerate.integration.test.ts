import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { makeLetter, resetLetterTables } from "../../../test/setup/letter-fixtures";
import { createMemoryDirectory } from "../../../test/setup/memory-directory";
import { makeWorkspaceCv } from "../../../test/setup/workspace-fixtures";
import { agentsMarkdown, isUntouched, referenceFiles } from "./agent-files";
import { readAppDocuments } from "./apply-stored";
import type { ChangeSource } from "./change-source";
import { createDirectoryAdapter } from "./directory-adapter";
import { createWorkspaceRuntime, type WorkspaceRuntime } from "./runtime";
import { analyzeFolder, runSetup } from "./setup";

const STAND_IN = { kind: "directory", name: "w" } as unknown as FileSystemDirectoryHandle;
const quietSource = (): ChangeSource => ({ kind: "poll", slow: false, async start() {}, stop() {}, nudge() {}, onVisibilityChange() {} });
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function connected() {
    const dir = createMemoryDirectory("w");
    const adapter = createDirectoryAdapter(dir.root as unknown as FileSystemDirectoryHandle);
    const docs = await readAppDocuments();
    const analysis = await analyzeFolder(adapter, docs, { hideContact: false, now: 1 });
    await runSetup({ adapter, handle: STAND_IN, plan: analysis.plan, appDocs: analysis.appDocs, docs, options: { hideContact: false, now: 1 } });
    const start = async () => {
        const runtime = createWorkspaceRuntime({ adapter, hideContact: () => false, isVisible: () => true, createSource: quietSource, requests: false });
        await runtime.start();
        return runtime;
    };
    return { dir, adapter, start };
}

const MACHINE_FILES = [".enginecv/index.json", ".enginecv/workspace.json", ".enginecv/.gitignore", ".enginecv/reference/cv-format.md", ".enginecv/reference/letter-format.md", ".enginecv/reference/exports.md", ".enginecv/reference/recipes.md", "AGENTS.md", "README.md"];

describe("agent files: made again, never over the person's edits", () => {
    let current: WorkspaceRuntime | null = null;
    beforeEach(async () => {
        await resetLetterTables();
        await db.workspace.clear();
        await db.workspaceDocs.clear();
        await db.resumes.put(makeWorkspaceCv({ id: "cv-1", title: "Master CV" }));
        await db.coverLetters.put(makeLetter({ id: "l-1", cvId: "cv-1", title: "Acme", company: "Acme", role: "Designer" }));
    });
    afterEach(() => {
        current?.stop();
        current = null;
    });

    it("writes every instruction, reference and marker file at setup", async () => {
        const { dir } = await connected();
        for (const path of MACHINE_FILES) expect(await dir.readExternal(path), path).not.toBeNull();
        for (const name of Object.keys(referenceFiles())) expect(isUntouched((await dir.readExternal(`.enginecv/reference/${name}`))!)).toBe(true);
    });

    it("makes them all again when .enginecv/ and the instruction files are deleted, without touching documents", async () => {
        const { dir, start } = await connected();
        const cvBefore = await dir.readExternal("cvs/Master CV.cv.json");
        const letterBefore = await dir.readExternal("letters/Acme.letter.json");
        const dbBefore = JSON.stringify(await db.resumes.toArray()) + JSON.stringify(await db.coverLetters.toArray());
        for (const path of MACHINE_FILES) await dir.removeExternal(path);
        for (const path of [".enginecv/requests/.keep", ".enginecv/results/.keep"]) await dir.removeExternal(path);

        current = await start();
        for (const path of MACHINE_FILES) expect(await dir.readExternal(path), `${path} came back`).not.toBeNull();
        expect(await dir.readExternal(".enginecv/requests/.keep")).not.toBeNull();
        expect(await dir.readExternal("cvs/Master CV.cv.json")).toBe(cvBefore);
        expect(await dir.readExternal("letters/Acme.letter.json")).toBe(letterBefore);
        expect(JSON.stringify(await db.resumes.toArray()) + JSON.stringify(await db.coverLetters.toArray())).toBe(dbBefore);
    });

    it("leaves a person-edited AGENTS.md alone and writes the fresh copy beside it", async () => {
        const { dir, start } = await connected();
        const edited = `${(await dir.readExternal("AGENTS.md"))!}\nMy own rule: always answer in German.\n`;
        await dir.writeExternal("AGENTS.md", edited);
        current = await start();
        expect(await dir.readExternal("AGENTS.md")).toBe(edited);
        expect(await dir.readExternal(".enginecv/reference/AGENTS.fresh.md")).toBe(agentsMarkdown());
    });

    it("replaces an out-of-date generated copy, but not one the person changed", async () => {
        const { dir, start } = await connected();
        // An older generated version: its stored hash matches its own text, so it is untouched, just old.
        const body = "# EngineCV workspace\nolder wording\n";
        const lines = (await dir.readExternal("AGENTS.md"))!.split("\n");
        const { hashText } = await import("@/lib/workspace/hash");
        await dir.writeExternal("AGENTS.md", `${lines[0]}\n<!-- hash:${hashText(body)} -->\n${body}`);
        current = await start();
        expect(await dir.readExternal("AGENTS.md")).toBe(agentsMarkdown());
    });

    it("keeps the index current: a new CV, a letter and a document in trouble appear within a couple of seconds", async () => {
        const { dir, start } = await connected();
        current = await start();
        await db.resumes.put(makeWorkspaceCv({ id: "cv-2", title: "Designer CV" }));
        await db.coverLetters.put(makeLetter({ id: "l-2", cvId: "cv-2", title: "Initech", company: "Initech", role: "Lead" }));
        const { mirrorNow } = await import("./controller").then((module) => ({ mirrorNow: module.mirrorNow }));
        void mirrorNow; // the controller's own mirroring is covered elsewhere; here the runtime refreshes the index after a change
        const { mirrorDocuments } = await import("./lifecycle");
        const adapter = createDirectoryAdapter(dir.root as unknown as FileSystemDirectoryHandle);
        await mirrorDocuments(adapter, { hideContact: false });
        current.refreshIndexSoon();
        await wait(2600);
        const index = JSON.parse((await dir.readExternal(".enginecv/index.json"))!);
        expect(index.cvs.map((cv: { title: string }) => cv.title).sort()).toEqual(["Designer CV", "Master CV"]);
        expect(index.letters.map((letter: { company: string }) => letter.company).sort()).toEqual(["Acme", "Initech"]);

        await dir.writeExternal("cvs/Master CV.cv.json", "{ half a fi");
        await current.checkNow();
        await wait(2600);
        const after = JSON.parse((await dir.readExternal(".enginecv/index.json"))!);
        expect(after.cvs.find((cv: { title: string }) => cv.title === "Master CV")).toMatchObject({ state: "blocked", reason: expect.any(String) });
        expect(JSON.stringify(after)).not.toContain("half a fi");
    }, 20_000);

    it("does not rewrite an index that did not change", async () => {
        const { dir, start } = await connected();
        const before = await dir.readExternal(".enginecv/index.json");
        current = await start();
        current.refreshIndexSoon();
        await wait(2400);
        expect(await dir.readExternal(".enginecv/index.json")).toBe(before);
    });
});
