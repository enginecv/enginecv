import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetLetterTables } from "../../../test/setup/letter-fixtures";
import { createMemoryDirectory } from "../../../test/setup/memory-directory";
import { editFile, makeWorkspaceCv } from "../../../test/setup/workspace-fixtures";
import { undoActivity } from "./activity";
import { readAppDocuments } from "./apply-stored";
import type { ChangeSource } from "./change-source";
import { createDirectoryAdapter } from "./directory-adapter";
import { createWorkspaceRuntime, type WorkspaceRuntime } from "./runtime";
import { analyzeFolder, runSetup } from "./setup";

const STAND_IN = { kind: "directory", name: "w" } as unknown as FileSystemDirectoryHandle;
const FILE = "cvs/Master CV.cv.json";
const quietSource = (): ChangeSource => ({ kind: "poll", slow: false, async start() {}, stop() {}, nudge() {}, onVisibilityChange() {} });
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("undoing an agent's change, end to end", () => {
    let current: WorkspaceRuntime | null = null;
    beforeEach(async () => {
        await resetLetterTables();
        await db.workspace.clear();
        await db.workspaceDocs.clear();
        await db.workspaceActivity.clear();
        await db.resumeHistory.clear();
        await db.resumes.put(makeWorkspaceCv({ id: "cv-1", title: "Master CV" }));
    });
    afterEach(() => {
        current?.stop();
        current = null;
    });

    it("an accepted file change can be undone: the CV returns to before and the file follows", async () => {
        const dir = createMemoryDirectory("w");
        const adapter = createDirectoryAdapter(dir.root as unknown as FileSystemDirectoryHandle);
        const docs = await readAppDocuments();
        const analysis = await analyzeFolder(adapter, docs, { hideContact: false, now: 1 });
        await runSetup({ adapter, handle: STAND_IN, plan: analysis.plan, appDocs: analysis.appDocs, docs, options: { hideContact: false, now: 1 } });
        const runtime = createWorkspaceRuntime({ adapter, hideContact: () => false, isVisible: () => true, createSource: quietSource, requests: false, machineFiles: false });
        current = runtime;
        await runtime.start();

        const original = (await db.resumes.get("cv-1"))!.basics.headline;
        const text = (await dir.readExternal(FILE))!;
        await dir.writeExternal(FILE, editFile(text, (doc) => { (doc.basics as Record<string, unknown>).headline = "Changed by an agent"; }));
        await runtime.checkNow();
        await wait(60);
        expect((await db.resumes.get("cv-1"))?.basics.headline).toBe("Changed by an agent");

        const accepted = (await db.workspaceActivity.toArray()).find((entry) => entry.kind === "accepted" && entry.restoreId !== null)!;
        expect(accepted).toBeDefined();
        expect(await undoActivity(accepted.id!)).toEqual({ ok: true });
        expect((await db.resumes.get("cv-1"))?.basics.headline).toBe(original);

        await wait(1400); // the write debounce
        expect(JSON.parse((await dir.readExternal(FILE))!).basics.headline).toBe(original);
        expect((await db.workspaceDocs.get("cv-1"))?.state).toBe("in-sync");
        expect(await undoActivity(accepted.id!)).toEqual({ ok: false, reason: "not-undoable" }); // once
    }, 15_000);
});
