import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LinkedFileRecord } from "@/lib/db";
import { FakeDisk, asHandle } from "../../../test/setup/fake-file-handle";

// A structured clone (what IndexedDB does) keeps a real handle's methods but would
// strip the fake's, so the table is a Map that stores the records as they are.
const rows = new Map<string, LinkedFileRecord>();
vi.mock("@/lib/db", () => ({
    db: {
        linkedFiles: {
            get: async (id: string) => rows.get(id),
            toArray: async () => [...rows.values()],
            put: async (record: LinkedFileRecord) => void rows.set(record.resumeId, record),
            update: async (id: string, changes: Partial<LinkedFileRecord>) => {
                const row = rows.get(id);
                if (row) rows.set(id, { ...row, ...changes });
            },
            delete: async (id: string) => void rows.delete(id),
        },
    },
}));

import { LinkedElsewhereError, getLink, listLinks, removeLink, saveLink, setPaused } from "./link-store";

const record = (resumeId: string, handle: FileSystemFileHandle): LinkedFileRecord => ({
    resumeId,
    handle,
    fileName: handle.name,
    linkedAt: 1,
    paused: false,
});

beforeEach(() => rows.clear());

describe("link-store", () => {
    it("saves, reads, pauses and removes a link", async () => {
        const disk = new FakeDisk();
        await saveLink(record("cv-1", asHandle(disk.create("a.enginecv.json"))));
        expect((await getLink("cv-1"))?.fileName).toBe("a.enginecv.json");
        await setPaused("cv-1", true);
        expect((await getLink("cv-1"))?.paused).toBe(true);
        await removeLink("cv-1");
        expect(await getLink("cv-1")).toBeUndefined();
    });

    it("refuses a file that another CV owns, naming the owner", async () => {
        const disk = new FakeDisk();
        await saveLink(record("cv-1", asHandle(disk.create("a.enginecv.json"))));
        const again = saveLink(record("cv-2", asHandle(new (await import("../../../test/setup/fake-file-handle")).FakeFileHandle(disk, "a.enginecv.json"))));
        await expect(again).rejects.toBeInstanceOf(LinkedElsewhereError);
        await expect(again).rejects.toMatchObject({ ownerResumeId: "cv-1" });
        expect(await listLinks()).toHaveLength(1);
    });

    it("lets a CV relink its own file and link different files to different CVs", async () => {
        const disk = new FakeDisk();
        const a = asHandle(disk.create("a.json"));
        const b = asHandle(disk.create("b.json"));
        await saveLink(record("cv-1", a));
        await saveLink(record("cv-1", a));
        await saveLink(record("cv-2", b));
        expect(await listLinks()).toHaveLength(2);
    });
});
