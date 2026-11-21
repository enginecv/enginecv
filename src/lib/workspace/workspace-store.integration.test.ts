import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { ACTIVITY_CAP } from "./types";
import {
    addActivity,
    clearWorkspace,
    getDocRow,
    getWorkspace,
    listActivity,
    listDocRows,
    newDocRow,
    patchDocRow,
    putDocRow,
    removeDocRow,
    saveWorkspace,
    setDocState,
    updateWorkspace,
} from "./workspace-store";

const handle = {} as FileSystemDirectoryHandle;

describe("workspace store", () => {
    beforeEach(async () => {
        await db.workspace.clear();
        await db.workspaceDocs.clear();
        await db.workspaceActivity.clear();
    });

    it("keeps one workspace row and updates it in place", async () => {
        expect(await getWorkspace()).toBeUndefined();
        await saveWorkspace({ handle, folderName: "applications", createdAt: 1, formatVersion: 1, hideContact: false, paused: false, changeSource: "poll" });
        await updateWorkspace({ hideContact: true, changeSource: "observer" });
        expect(await getWorkspace()).toMatchObject({ id: "current", folderName: "applications", hideContact: true, changeSource: "observer" });
        await saveWorkspace({ handle, folderName: "other", createdAt: 2, formatVersion: 1, hideContact: false, paused: false, changeSource: "poll" });
        expect(await db.workspace.count()).toBe(1);
    });

    it("tracks per-document state and reasons", async () => {
        await putDocRow(newDocRow({ docId: "cv-1", kind: "cv", fileName: "a.cv.json" }, 1));
        await setDocState("cv-1", "blocked", { code: "cut-off", line: 3, column: 9 }, 5);
        expect(await getDocRow("cv-1")).toMatchObject({ state: "blocked", reason: { code: "cut-off", line: 3 }, updatedAt: 5, included: true });
        await setDocState("cv-1", "in-sync", null, 6);
        expect((await getDocRow("cv-1"))?.reason).toBeNull();
        await patchDocRow("cv-1", { included: false }, 7);
        expect((await listDocRows())[0].included).toBe(false);
        await removeDocRow("cv-1");
        expect(await listDocRows()).toEqual([]);
    });

    it("forgets the workspace and its document rows but not the activity log", async () => {
        await saveWorkspace({ handle, folderName: "w", createdAt: 1, formatVersion: 1, hideContact: false, paused: false, changeSource: "poll" });
        await putDocRow(newDocRow({ docId: "cv-1", kind: "cv" }, 1));
        await addActivity({ at: 1, docId: "cv-1", kind: "info", reason: { code: "permission" }, restoreId: null, restoreKind: null });
        await clearWorkspace();
        expect(await getWorkspace()).toBeUndefined();
        expect(await listDocRows()).toEqual([]);
        expect(await listActivity()).toHaveLength(1);
    });

    it("caps the activity log and pages it newest first", async () => {
        for (let i = 0; i < ACTIVITY_CAP + 25; i++) {
            await addActivity({ at: i, docId: null, kind: "accepted", reason: { code: "empty", detail: `n${i}` }, restoreId: null, restoreKind: null });
        }
        expect(await db.workspaceActivity.count()).toBe(ACTIVITY_CAP);
        const first = await listActivity({ limit: 50 });
        expect(first).toHaveLength(50);
        expect(first[0].reason.detail).toBe(`n${ACTIVITY_CAP + 24}`);
        const next = await listActivity({ limit: 50, before: first[first.length - 1].id });
        expect(next[0].at).toBe(first[first.length - 1].at - 1);
        const oldest = await db.workspaceActivity.orderBy("id").first();
        expect(oldest?.reason.detail).toBe("n25");
    }, 30_000);
});
