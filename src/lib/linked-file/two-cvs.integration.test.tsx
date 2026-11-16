import "fake-indexeddb/auto";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLinkedFile } from "@/hooks/useLinkedFile";
import { createEmptyResume } from "@/lib/schema";
import { useResumeStore } from "@/lib/store";
import { FakeDisk, asHandle } from "../../../test/setup/fake-file-handle";
import { installMemoryLinkTable } from "../../../test/setup/memory-link-table";
import { detachLink, getActiveEngine } from "./controller";
import { saveLink } from "./link-store";
import { canonicalText } from "./sync-engine";

function cv(id: string, name: string) {
    return { ...createEmptyResume(), id, updatedAt: 1, basics: { ...createEmptyResume().basics, name } };
}

function open(resume: ReturnType<typeof cv>) {
    useResumeStore.setState({ resume, activeResumeId: resume.id, isDirty: false });
}

beforeEach(() => {
    installMemoryLinkTable();
    useResumeStore.getState().resetLinkedFile();
    window.showOpenFilePicker = vi.fn();
    window.showSaveFilePicker = vi.fn();
});
afterEach(() => {
    detachLink();
    vi.restoreAllMocks();
    delete (window as { showOpenFilePicker?: unknown }).showOpenFilePicker;
    delete (window as { showSaveFilePicker?: unknown }).showSaveFilePicker;
});

describe("two linked CVs", () => {
    it("each writes only its own file, and switching never cross-writes", async () => {
        const disk = new FakeDisk();
        const a = cv("cv-a", "Alice");
        const b = cv("cv-b", "Bob");
        const fileA = disk.create("a.enginecv.json", canonicalText(a));
        const fileB = disk.create("b.enginecv.json", canonicalText(b));
        await saveLink({ resumeId: "cv-a", handle: asHandle(fileA), fileName: "a.enginecv.json", linkedAt: 1, paused: false });
        await saveLink({ resumeId: "cv-b", handle: asHandle(fileB), fileName: "b.enginecv.json", linkedAt: 1, paused: false });

        open(a);
        const hook = renderHook(({ id }) => useLinkedFile(id, true), { initialProps: { id: "cv-a" } });
        await waitFor(() => expect(getActiveEngine("cv-a")).not.toBeNull());
        act(() => useResumeStore.getState().updateBasics({ name: "Alice edited" }));
        await waitFor(() => expect(JSON.parse(disk.read("a.enginecv.json")!).basics.name).toBe("Alice edited"), { timeout: 4000 });
        const bBefore = disk.read("b.enginecv.json");
        expect(bBefore).toBe(canonicalText(b));

        // Switch to the other CV: the first engine stops, the second takes over.
        open(b);
        hook.rerender({ id: "cv-b" });
        await waitFor(() => expect(getActiveEngine("cv-b")).not.toBeNull());
        expect(getActiveEngine("cv-a")).toBeNull();
        const aAfterSwitch = disk.read("a.enginecv.json");
        act(() => useResumeStore.getState().updateBasics({ name: "Bob edited" }));
        await waitFor(() => expect(JSON.parse(disk.read("b.enginecv.json")!).basics.name).toBe("Bob edited"), { timeout: 4000 });
        expect(disk.read("a.enginecv.json")).toBe(aAfterSwitch);
        expect(useResumeStore.getState().linkedFile.fileName).toBe("b.enginecv.json");
    }, 20_000);
});
