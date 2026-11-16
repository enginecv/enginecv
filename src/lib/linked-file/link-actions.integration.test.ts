import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeDisk, FakeFileHandle, asHandle } from "../../../test/setup/fake-file-handle";
import { installMemoryLinkTable } from "../../../test/setup/memory-link-table";
import { db } from "@/lib/db";
import { createEmptyResume } from "@/lib/schema";
import { useResumeStore } from "@/lib/store";
import { detachLink } from "./controller";
import { linkFile, unlinkFile } from "./link-actions";
import { getLink } from "./link-store";
import { canonicalText } from "./sync-engine";
import { doc } from "./sync-engine.test-harness";

let rows: ReturnType<typeof installMemoryLinkTable>;

function openResume(id: string, title: string, name = "Amina") {
    const resume = { ...createEmptyResume(), id, updatedAt: 1 };
    resume.meta.title = title;
    resume.basics.name = name;
    useResumeStore.setState({ resume, activeResumeId: id, isDirty: false });
    return resume;
}

beforeEach(async () => {
    rows = installMemoryLinkTable();
    await db.resumeHistory.clear();
    useResumeStore.getState().resetLinkedFile();
});
afterEach(() => {
    detachLink();
    vi.restoreAllMocks();
});

describe("linkFile: create new", () => {
    it("fills the new file, names the CV after it, and asks the browser to persist storage once", async () => {
        const persist = vi.fn().mockResolvedValue(true);
        Object.defineProperty(navigator, "storage", { configurable: true, value: { persist } });
        openResume("cv-1", "My CV");
        const disk = new FakeDisk();
        const handle = disk.create("Chosen name.enginecv.json");
        const pickNew = vi.fn().mockResolvedValue(asHandle(handle));

        const result = await linkFile("cv-1", "createNew", { pickNew });

        expect(result).toEqual({ ok: true });
        expect(pickNew).toHaveBeenCalledWith("My CV.enginecv.json");
        expect(disk.read("Chosen name.enginecv.json")).toBe(canonicalText(useResumeStore.getState().resume).replace(/My CV/, "Chosen name"));
        expect(useResumeStore.getState().resume.meta.title).toBe("Chosen name");
        expect((await getLink("cv-1"))?.fileName).toBe("Chosen name.enginecv.json");
        expect(useResumeStore.getState().linkedFile.status).toBe("in-sync");
        expect(persist).toHaveBeenCalledTimes(1);
    });

    it("writes nothing and picks nothing when the privacy notice is declined", async () => {
        openResume("cv-1", "My CV");
        const pickNew = vi.fn();
        const result = await linkFile("cv-1", "createNew", { pickNew, confirmPrivacy: async () => false });
        expect(result).toEqual({ ok: false, reason: "cancelled" });
        expect(pickNew).not.toHaveBeenCalled();
        expect(await getLink("cv-1")).toBeUndefined();
    });

    it("does nothing when the picker is closed", async () => {
        openResume("cv-1", "My CV");
        const result = await linkFile("cv-1", "createNew", { pickNew: async () => null });
        expect(result).toEqual({ ok: false, reason: "cancelled" });
        expect(rows.size).toBe(0);
    });

    it("gives two CVs with the same title distinct file suggestions only through the picker, and refuses a second link to one file", async () => {
        const disk = new FakeDisk();
        const handle = disk.create("Same.enginecv.json");
        openResume("cv-1", "Same");
        expect(await linkFile("cv-1", "createNew", { pickNew: async () => asHandle(handle) })).toEqual({ ok: true });
        detachLink();

        openResume("cv-2", "Same", "Other person");
        const before = disk.read("Same.enginecv.json");
        const result = await linkFile("cv-2", "createNew", { pickNew: async () => asHandle(new FakeFileHandle(disk, "Same.enginecv.json")) });
        expect(result).toMatchObject({ ok: false, reason: "linked-elsewhere", ownerResumeId: "cv-1" });
        expect(disk.read("Same.enginecv.json")).toBe(before);
        expect(await getLink("cv-2")).toBeUndefined();
    });
});

describe("linkFile: use existing", () => {
    it("loads the file after a snapshot and adopts its name", async () => {
        const before = openResume("cv-1", "Old title", "Typed locally");
        const disk = new FakeDisk();
        const handle = disk.create("From disk.enginecv.json", doc({ basics: { name: "From the file" }, projects: [{ name: "Agent project" }] }));
        const result = await linkFile("cv-1", "useExisting", {
            pickExisting: async () => asHandle(handle),
            confirmExisting: async () => "load",
        });
        expect(result).toEqual({ ok: true });
        const state = useResumeStore.getState().resume;
        expect(state.basics.name).toBe("From the file");
        expect(state.projects[0].name).toBe("Agent project");
        expect(state.meta.title).toBe("From disk");
        expect(state.id).toBe(before.id);
        const history = await db.resumeHistory.where("resumeId").equals("cv-1").toArray();
        // The state before the update is kept: as a file-sync snapshot, or as the autosave that flushed unsaved typing first.
        expect(history.some((entry) => JSON.parse(entry.resumeJson).basics.name === "Typed locally")).toBe(true);
    });

    it("overwrites the file with the CV when asked", async () => {
        openResume("cv-1", "Mine", "My content");
        const disk = new FakeDisk();
        const handle = disk.create("Other.enginecv.json", doc({ basics: { name: "Theirs" } }));
        await linkFile("cv-1", "useExisting", { pickExisting: async () => asHandle(handle), confirmExisting: async () => "overwrite" });
        expect(JSON.parse(disk.read("Other.enginecv.json")!).basics.name).toBe("My content");
        expect(useResumeStore.getState().resume.basics.name).toBe("My content");
    });

    it("never decides silently: cancelling the choice leaves file and CV alone", async () => {
        openResume("cv-1", "Mine", "My content");
        const disk = new FakeDisk();
        const content = doc({ basics: { name: "Theirs" } });
        const handle = disk.create("Other.enginecv.json", content);
        const result = await linkFile("cv-1", "useExisting", { pickExisting: async () => asHandle(handle), confirmExisting: async () => null });
        expect(result).toEqual({ ok: false, reason: "cancelled" });
        expect(disk.read("Other.enginecv.json")).toBe(content);
        expect(useResumeStore.getState().resume.basics.name).toBe("My content");
        expect(await getLink("cv-1")).toBeUndefined();
    });
});

describe("unlinkFile", () => {
    it("keeps the file and the CV content", async () => {
        openResume("cv-1", "Mine", "Keep me");
        const disk = new FakeDisk();
        const handle = disk.create("Mine.enginecv.json");
        await linkFile("cv-1", "createNew", { pickNew: async () => asHandle(handle) });
        const fileBefore = disk.read("Mine.enginecv.json");
        await unlinkFile("cv-1");
        expect(await getLink("cv-1")).toBeUndefined();
        expect(disk.read("Mine.enginecv.json")).toBe(fileBefore);
        expect(useResumeStore.getState().resume.basics.name).toBe("Keep me");
        expect(useResumeStore.getState().linkedFile.status).toBe("none");
    });
});
