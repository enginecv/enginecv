import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CvTitleInput } from "@/components/editor/CvTitleInput";
import { db } from "@/lib/db";
import { useI18nStore } from "@/lib/i18n";
import { duplicateResume } from "@/lib/resume-operations";
import { createEmptyResume } from "@/lib/schema";
import { useResumeStore } from "@/lib/store";
import { FakeDisk, asHandle } from "../../../test/setup/fake-file-handle";
import { installMemoryLinkTable } from "../../../test/setup/memory-link-table";
import { detachLink } from "./controller";
import { linkFile } from "./link-actions";
import { getLink } from "./link-store";
import { renameLinkedCv } from "./rename";

async function linkedCv(title = "My CV") {
    const resume = { ...createEmptyResume(), id: "cv-1", updatedAt: 1 };
    resume.meta.title = title;
    useResumeStore.setState({ resume, activeResumeId: "cv-1", isDirty: false });
    const disk = new FakeDisk();
    const handle = disk.create(`${title}.enginecv.json`);
    await linkFile("cv-1", "createNew", { pickNew: async () => asHandle(handle) });
    return { disk, handle };
}

beforeEach(() => {
    installMemoryLinkTable();
    useResumeStore.getState().resetLinkedFile();
    act(() => useI18nStore.setState({ locale: "en", _hydrated: true }));
});
afterEach(() => {
    cleanup();
    detachLink();
    vi.restoreAllMocks();
});

describe("renameLinkedCv", () => {
    it("refuses a name that would change the file name, and touches nothing", async () => {
        const { disk, handle } = await linkedCv();
        disk.create("Other.enginecv.json", "precious");
        const result = await renameLinkedCv("cv-1", "Other");
        expect(result).toEqual({ ok: false, error: "linked" });
        expect(disk.files.has("My CV.enginecv.json")).toBe(true);
        expect(disk.read("Other.enginecv.json")).toBe("precious");
        expect(handle.name).toBe("My CV.enginecv.json");
        expect((await getLink("cv-1"))?.fileName).toBe("My CV.enginecv.json");
    });

    it("accepts the name the file already has", async () => {
        await linkedCv();
        expect(await renameLinkedCv("cv-1", "My CV")).toEqual({ ok: true, title: "My CV", linked: true });
    });

    it("passes the title through for a CV that is not linked", async () => {
        expect(await renameLinkedCv("cv-9", "Whatever")).toEqual({ ok: true, title: "Whatever", linked: false });
    });
});

describe("the editor header name", () => {
    it("keeps the name and says what to do when a linked CV is renamed", async () => {
        const { disk } = await linkedCv();
        render(<CvTitleInput />);
        const input = screen.getByTestId("cv-title-input");
        fireEvent.change(input, { target: { value: "Renamed" } });
        expect(useResumeStore.getState().resume.meta.title).toBe("My CV");
        fireEvent.blur(input);
        expect(await screen.findByTestId("cv-title-error")).toHaveTextContent("Rename the file in your file manager");
        expect(useResumeStore.getState().resume.meta.title).toBe("My CV");
        expect(disk.files.has("My CV.enginecv.json")).toBe(true);
        expect((input as HTMLInputElement).value).toBe("My CV");
    });

    it("edits an unlinked CV live, as before", () => {
        const resume = { ...createEmptyResume(), id: "cv-2", updatedAt: 1 };
        useResumeStore.setState({ resume, activeResumeId: "cv-2", isDirty: false });
        render(<CvTitleInput />);
        fireEvent.change(screen.getByTestId("cv-title-input"), { target: { value: "Live" } });
        expect(useResumeStore.getState().resume.meta.title).toBe("Live");
    });
});

describe("other places that write a CV name", () => {
    it("a duplicate of a linked CV is not linked and keeps its title", async () => {
        await linkedCv();
        const source = useResumeStore.getState().resume;
        await db.resumes.put(source);
        const duplicateId = await duplicateResume(source, "copy");
        expect(await getLink(duplicateId)).toBeUndefined();
        expect((await db.resumes.get(duplicateId))?.meta.title).toBe("My CV (copy)");
        expect(await getLink("cv-1")).toBeDefined();
    });
});
