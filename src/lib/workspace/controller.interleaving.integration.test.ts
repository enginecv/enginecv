import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { recordResumeHistory } from "@/lib/history";
import { parseCv } from "@/lib/letters/store";
import { resetLetterTables } from "../../../test/setup/letter-fixtures";
import { createMemoryDirectory } from "../../../test/setup/memory-directory";
import { editFile, makeWorkspaceCv } from "../../../test/setup/workspace-fixtures";

let current = createMemoryDirectory("applications");
vi.mock("./directory-adapter", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./directory-adapter")>();
    return { ...actual, isWorkspaceSupported: () => true, createDirectoryAdapter: () => actual.createDirectoryAdapter(current.root as unknown as FileSystemDirectoryHandle) };
});
vi.mock("./leader", () => ({
    createLeader: () => ({ start() {}, stop() {}, isLeader: true, onChange: (listener: (value: boolean) => void) => { listener(true); return () => undefined; }, nudge() {}, onNudge: () => () => undefined }),
}));

const STAND_IN = { kind: "directory", name: "applications" } as unknown as FileSystemDirectoryHandle;
const DOCS = ["cv-1", "cv-2", "cv-3"];
const fileOf = (id: string) => `cvs/${id.toUpperCase()}.cv.json`;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Small seeded generator so a failing order can be replayed. */
function rng(seed: number) {
    let state = seed >>> 0;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 2 ** 32;
    };
}

const headlineIn = (text: string | null) => (text ? (JSON.parse(text) as { basics?: { headline?: string } }).basics?.headline : undefined);

describe("workspace controller: random interleavings never lose a side's last complete version (SC-005)", () => {
    beforeEach(async () => {
        (await import("./controller")).resetWorkspaceController();
        current = createMemoryDirectory("applications");
        await resetLetterTables();
        await db.workspace.clear();
        await db.workspaceDocs.clear();
        await db.resumeHistory.clear();
        await db.resumes.clear();
        for (const id of DOCS) await db.resumes.put(makeWorkspaceCv({ id, title: id.toUpperCase() }));
    });
    afterEach(async () => {
        (await import("./controller")).resetWorkspaceController();
    });

    for (const seed of [1, 3, 7, 14, 42, 99, 2026, 31337]) {
        it(`seed ${seed}`, async () => {
            const controller = await import("./controller");
            const options = { hideContact: false, now: 1 };
            await controller.connectFolder({ handle: STAND_IN, analysis: await controller.analyzeFolderHandle(STAND_IN, options), options });
            await wait(100);

            const next = rng(seed);
            const lastApp = new Map<string, string>();
            const lastOutside = new Map<string, string>();
            let counter = 0;

            for (let step = 0; step < 10; step += 1) {
                const id = DOCS[Math.floor(next() * DOCS.length)];
                const action = Math.floor(next() * 5);
                counter += 1;
                if (action === 0 || action === 1) {
                    const headline = `app-${seed}-${counter}`;
                    const row = (await db.resumes.get(id))!;
                    // Typing over a version that was already applied and showing is a deliberate overwrite; typing while an outside change is still unread is the case that must lose nothing.
                    if (row.basics.headline === lastOutside.get(id)) lastOutside.delete(id);
                    // Like the editor's save: the document, and an autosave history entry of what was saved.
                    const saved = { ...row, basics: { ...row.basics, headline }, updatedAt: row.updatedAt + 1 };
                    await db.resumes.put(saved);
                    await recordResumeHistory(parseCv(saved)!, "autosave");
                    lastApp.set(id, headline);
                } else if (action === 2) {
                    const text = await current.readExternal(fileOf(id));
                    if (text && !text.includes("crswap")) {
                        const headline = `out-${seed}-${counter}`;
                        try {
                            await current.writeExternal(fileOf(id), editFile(text, (doc) => { (doc.basics as Record<string, unknown>).headline = headline; }));
                            lastOutside.set(id, headline);
                        } catch {
                            // The file was not complete JSON at that moment; nothing was written by the outside program either.
                        }
                    }
                } else if (action === 3) {
                    current.setPermission("prompt", "granted");
                    await controller.verifyFolder();
                    await wait(20);
                    await controller.resumePermission();
                } else {
                    await controller.getRuntime()?.checkNow();
                }
                await wait(Math.floor(next() * 400));
            }

            // Let everything settle: permission back, writes flushed, outside edits read.
            current.setPermission("granted");
            if (controller.useWorkspaceStore.getState().phase !== "connected") await controller.resumePermission();
            for (let round = 0; round < 3; round += 1) {
                await wait(1100);
                await controller.getRuntime()?.checkNow();
            }

            for (const id of DOCS) {
                const history = (await db.resumeHistory.where("resumeId").equals(id).toArray()).map((entry) => headlineIn(entry.resumeJson));
                const reachable = new Set<string | undefined>([(await db.resumes.get(id))?.basics.headline, headlineIn(await current.readExternal(fileOf(id))), ...history]);
                const appSide = lastApp.get(id);
                const outsideSide = lastOutside.get(id);
                if (appSide) expect(reachable.has(appSide), `seed ${seed}: app version ${appSide} of ${id} was lost`).toBe(true);
                if (outsideSide) expect(reachable.has(outsideSide), `seed ${seed}: outside version ${outsideSide} of ${id} was lost`).toBe(true);
                // And the two sides agree once settled.
                expect(headlineIn(await current.readExternal(fileOf(id))), `seed ${seed}: ${id} file and document disagree`).toBe((await db.resumes.get(id))?.basics.headline);
            }
        }, 60_000);
    }
});
