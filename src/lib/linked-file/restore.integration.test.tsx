import "fake-indexeddb/auto";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLinkedFile } from "@/hooks/useLinkedFile";
import { db } from "@/lib/db";
import { createEmptyResume } from "@/lib/schema";
import { useResumeStore } from "@/lib/store";
import { FakeDisk, asHandle } from "../../../test/setup/fake-file-handle";
import { installMemoryLinkTable } from "../../../test/setup/memory-link-table";
import { detachLink, grantAndAttach } from "./controller";
import { saveLink } from "./link-store";
import { canonicalText } from "./sync-engine";
import { doc } from "./sync-engine.test-harness";

function openResume(updatedAt: number, name = "Amina") {
    const resume = { ...createEmptyResume(), id: "cv-1", updatedAt };
    resume.basics.name = name;
    useResumeStore.setState({ resume, activeResumeId: "cv-1", isDirty: false });
    return resume;
}

async function linkedFile(content: string) {
    const disk = new FakeDisk();
    const handle = disk.create("cv.enginecv.json", content);
    await saveLink({ resumeId: "cv-1", handle: asHandle(handle), fileName: handle.name, linkedAt: 1, paused: false });
    return { disk, handle };
}

beforeEach(async () => {
    installMemoryLinkTable();
    await db.resumeHistory.clear();
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

describe("restoring a link on load", () => {
    it("resumes in sync when the file already matches the CV", async () => {
        const resume = openResume(1);
        await linkedFile(canonicalText(resume));
        renderHook(() => useLinkedFile("cv-1", true));
        await waitFor(() => expect(useResumeStore.getState().linkedFile.status).toBe("in-sync"));
        expect(useResumeStore.getState().linkedFile.lastUpdate).toBeNull();
    });

    it("applies edits made while the tab was closed, after a snapshot, and says so", async () => {
        openResume(1, "Before");
        await linkedFile(doc({ basics: { name: "Edited while closed" }, projects: [{ name: "Agent project" }] }));
        renderHook(() => useLinkedFile("cv-1", true));
        await waitFor(() => expect(useResumeStore.getState().resume.basics.name).toBe("Edited while closed"));
        expect(useResumeStore.getState().linkedFile.lastUpdate).toMatchObject({ added: 1 });
        const history = await db.resumeHistory.where("resumeId").equals("cv-1").toArray();
        expect(history.some((entry) => entry.trigger === "file-sync" && JSON.parse(entry.resumeJson).basics.name === "Before")).toBe(true);
    });

    it("never overwrites the file when the CV is the newer side: it asks", async () => {
        openResume(Date.now() + 100_000, "Newer in the editor");
        const content = doc({ basics: { name: "Older in the file" } });
        const { disk } = await linkedFile(content);
        renderHook(() => useLinkedFile("cv-1", true));
        await waitFor(() => expect(useResumeStore.getState().linkedFile.status).toBe("paused"));
        expect(useResumeStore.getState().linkedFile.divergence).toEqual({ fileChanged: false, cvChanged: true });
        expect(disk.read("cv.enginecv.json")).toBe(content);
        expect(useResumeStore.getState().resume.basics.name).toBe("Newer in the editor");
    });

    it("asks for permission once with a user gesture", async () => {
        const resume = openResume(1);
        const { handle } = await linkedFile(canonicalText(resume));
        handle.permission = "prompt";
        renderHook(() => useLinkedFile("cv-1", true));
        await waitFor(() => expect(useResumeStore.getState().linkedFile.status).toBe("needs-permission"));
        expect(useResumeStore.getState().linkedFile.fileName).toBe("cv.enginecv.json");
        expect(await grantAndAttach("cv-1")).toBe(true);
        expect(useResumeStore.getState().linkedFile.status).toBe("in-sync");
    });

    it("is broken when permission was denied or the file is gone", async () => {
        const resume = openResume(1);
        const { handle, disk } = await linkedFile(canonicalText(resume));
        handle.permission = "denied";
        const first = renderHook(() => useLinkedFile("cv-1", true));
        await waitFor(() => expect(useResumeStore.getState().linkedFile.status).toBe("broken"));
        first.unmount();

        handle.permission = "granted";
        disk.externalDelete("cv.enginecv.json");
        renderHook(() => useLinkedFile("cv-1", true));
        await waitFor(() => expect(useResumeStore.getState().linkedFile.status).toBe("broken"));
    });

    it("says unsupported without the pickers and does nothing without a link", async () => {
        delete (window as { showOpenFilePicker?: unknown }).showOpenFilePicker;
        delete (window as { showSaveFilePicker?: unknown }).showSaveFilePicker;
        openResume(1);
        renderHook(() => useLinkedFile("cv-1", true));
        await waitFor(() => expect(useResumeStore.getState().linkedFile.status).toBe("unsupported"));
    });

    it("stays idle for a CV with no link, and for template mode", async () => {
        openResume(1);
        renderHook(() => useLinkedFile("cv-1", true));
        await waitFor(() => expect(useResumeStore.getState().linkedFile.status).toBe("none"));
        useResumeStore.getState().setLinkedFile({ status: "none" });
        renderHook(() => useLinkedFile("cv-1", false));
        expect(useResumeStore.getState().linkedFile.status).toBe("none");
    });
});
