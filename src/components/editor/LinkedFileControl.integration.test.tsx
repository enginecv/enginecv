import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { useI18nStore } from "@/lib/i18n";
import { detachLink } from "@/lib/linked-file/controller";
import { getLink } from "@/lib/linked-file/link-store";
import { useClientPreferencesStore } from "@/lib/preferences/store";
import { createEmptyResume } from "@/lib/schema";
import { useResumeStore } from "@/lib/store";
import { FakeDisk, asHandle, type FakeFileHandle } from "../../../test/setup/fake-file-handle";
import { installMemoryLinkTable } from "../../../test/setup/memory-link-table";
import { LinkedFileControl } from "./LinkedFileControl";

const doc = (body: Record<string, unknown> = {}) =>
    JSON.stringify({ format: "enginecv.authoring/v1", basics: { name: "Amina" }, ...body }, null, 2);

function openResume(title = "My CV") {
    const resume = { ...createEmptyResume(), id: "cv-1", updatedAt: 1 };
    resume.meta.title = title;
    resume.basics.name = "Amina";
    useResumeStore.setState({ resume, activeResumeId: "cv-1", isDirty: false });
}

function installPickers(disk: FakeDisk, name = "My CV.enginecv.json") {
    const handle = disk.create(name);
    window.showSaveFilePicker = vi.fn().mockResolvedValue(asHandle(handle));
    window.showOpenFilePicker = vi.fn().mockResolvedValue([asHandle(handle)]);
    return handle;
}

async function openPanel() {
    fireEvent.click(screen.getByTestId("linked-file-trigger"));
    await screen.findByTestId("linked-file-panel");
}

/** The panel stays open after linking; clicking the trigger again would close it. */
async function ensurePanel() {
    if (!screen.queryByTestId("linked-file-panel")) await openPanel();
}

async function linkNew(disk: FakeDisk) {
    const handle = installPickers(disk);
    render(<LinkedFileControl resumeId="cv-1" />);
    await openPanel();
    fireEvent.click(screen.getByTestId("linked-file-create"));
    fireEvent.click(await screen.findByTestId("linked-file-privacy-continue"));
    await waitFor(() => expect(useResumeStore.getState().linkedFile.status).toBe("in-sync"));
    return handle;
}

beforeEach(async () => {
    installMemoryLinkTable();
    await db.resumeHistory.clear();
    useResumeStore.getState().resetLinkedFile();
    useClientPreferencesStore.setState({
        preferences: {
            ...useClientPreferencesStore.getState().preferences,
            editor: { ...useClientPreferencesStore.getState().preferences.editor, linkedFilePrivacyAcknowledged: false },
        },
    });
    act(() => useI18nStore.setState({ locale: "en", _hydrated: true }));
    openResume();
});

afterEach(() => {
    cleanup();
    detachLink();
    vi.restoreAllMocks();
    delete (window as { showOpenFilePicker?: unknown }).showOpenFilePicker;
    delete (window as { showSaveFilePicker?: unknown }).showSaveFilePicker;
});

describe("LinkedFileControl", () => {
    it("explains itself where the browser cannot link", async () => {
        render(<LinkedFileControl resumeId="cv-1" />);
        await openPanel();
        expect(screen.getByTestId("linked-file-unsupported")).toBeInTheDocument();
        expect(screen.queryByTestId("linked-file-create")).not.toBeInTheDocument();
    });

    it("links a new file behind the privacy notice and shows the file name and status", async () => {
        const disk = new FakeDisk();
        const handle = await linkNew(disk);
        expect(JSON.parse(disk.read(handle.name)!).basics.name).toBe("Amina");
        expect(screen.getByTestId("linked-file-trigger")).toHaveTextContent("My CV.enginecv.json");
        await ensurePanel();
        expect(screen.getByTestId("linked-file-live")).toHaveTextContent(/Synced|In sync/);
        expect((await getLink("cv-1"))?.fileName).toBe("My CV.enginecv.json");
    });

    it("cancelling the privacy notice writes nothing and never opens the picker", async () => {
        const disk = new FakeDisk();
        const handle = installPickers(disk);
        render(<LinkedFileControl resumeId="cv-1" />);
        await openPanel();
        fireEvent.click(screen.getByTestId("linked-file-create"));
        fireEvent.click(await screen.findByTestId("linked-file-privacy-cancel"));
        await waitFor(() => expect(screen.queryByTestId("linked-file-privacy-continue")).not.toBeInTheDocument());
        expect(window.showSaveFilePicker).not.toHaveBeenCalled();
        expect(disk.read(handle.name)).toBe("");
        expect(useResumeStore.getState().linkedFile.status).toBe("none");
    });

    it("shows the privacy notice once when the person asks not to see it again", async () => {
        const disk = new FakeDisk();
        installPickers(disk);
        render(<LinkedFileControl resumeId="cv-1" />);
        await openPanel();
        fireEvent.click(screen.getByTestId("linked-file-create"));
        fireEvent.click(await screen.findByTestId("linked-file-privacy-dont-show"));
        fireEvent.click(screen.getByTestId("linked-file-privacy-continue"));
        await waitFor(() => expect(useResumeStore.getState().linkedFile.status).toBe("in-sync"));
        expect(useClientPreferencesStore.getState().preferences.editor.linkedFilePrivacyAcknowledged).toBe(true);
    });

    it("follows an outside edit and reports it without an import step", async () => {
        const disk = new FakeDisk();
        const handle = await linkNew(disk);
        disk.externalWrite(handle.name, doc({ projects: [{ name: "Weather Bot" }] }));
        const message = await screen.findByTestId("linked-file-update", {}, { timeout: 6000 });
        expect(message).toHaveTextContent("Updated from file: 1 added");
        expect(useResumeStore.getState().resume.projects[0].name).toBe("Weather Bot");
    }, 15_000);

    it("restoring the snapshot taken before a file update writes the restored content back to the file", async () => {
        const disk = new FakeDisk();
        const handle = await linkNew(disk);
        disk.externalWrite(handle.name, doc({ projects: [{ name: "Added by agent" }] }));
        await waitFor(() => expect(useResumeStore.getState().resume.projects).toHaveLength(1), { timeout: 6000 });
        const entries = await db.resumeHistory.where("resumeId").equals("cv-1").toArray();
        const before = entries.find((entry) => JSON.parse(entry.resumeJson).projects.length === 0);
        expect(before, "a snapshot from before the update exists").toBeDefined();

        // What the history panel's restore does: put the snapshot into the editor as an unsaved change.
        act(() => useResumeStore.setState({ resume: { ...JSON.parse(before!.resumeJson), updatedAt: Date.now() }, isDirty: true }));
        await waitFor(() => expect(JSON.parse(disk.read(handle.name)!).projects).toBeUndefined(), { timeout: 6000 });
    }, 20_000);

    it("writes an editor change to the file", async () => {
        const disk = new FakeDisk();
        const handle = await linkNew(disk);
        act(() => useResumeStore.getState().updateBasics({ name: "Edited in the editor" }));
        await waitFor(() => expect(JSON.parse(disk.read(handle.name)!).basics.name).toBe("Edited in the editor"), { timeout: 5000 });
    }, 15_000);

    it("keeps the CV and the file when the file is invalid, and recovers once it is fixed", async () => {
        const disk = new FakeDisk();
        const handle = await linkNew(disk);
        const broken = '{\n  "format": "enginecv.authoring/v1",\n  "basics": { "name": }\n}';
        disk.externalWrite(handle.name, broken);
        await waitFor(() => expect(useResumeStore.getState().linkedFile.status).toBe("error"), { timeout: 6000 });
        await ensurePanel();
        const alert = await screen.findByTestId("linked-file-error");
        expect(alert).toHaveTextContent("not valid JSON");
        expect(alert).toHaveTextContent("Line 3, column 23");
        expect(useResumeStore.getState().resume.basics.name).toBe("Amina");
        expect(disk.read(handle.name)).toBe(broken);

        disk.externalWrite(handle.name, doc({ projects: [{ name: "Fixed" }] }));
        await waitFor(() => expect(useResumeStore.getState().linkedFile.status).toBe("in-sync"), { timeout: 6000 });
        expect(useResumeStore.getState().resume.projects[0].name).toBe("Fixed");
    }, 20_000);

    it("shows a broken link after an outside rename and relinks to adopt the new name", async () => {
        const disk = new FakeDisk();
        const handle = await linkNew(disk);
        disk.externalRename(handle.name, "Moved.enginecv.json");
        await waitFor(() => expect(useResumeStore.getState().linkedFile.status).toBe("broken"), { timeout: 6000 });
        expect(useResumeStore.getState().resume.basics.name).toBe("Amina");

        const moved = new (handle.constructor as new (disk: FakeDisk, name: string) => FakeFileHandle)(disk, "Moved.enginecv.json");
        window.showOpenFilePicker = vi.fn().mockResolvedValue([asHandle(moved)]);
        await ensurePanel();
        fireEvent.click(await screen.findByTestId("linked-file-relink"));
        fireEvent.click(await screen.findByTestId("linked-file-load"));
        await waitFor(() => expect(useResumeStore.getState().linkedFile.status).toBe("in-sync"));
        expect(useResumeStore.getState().resume.meta.title).toBe("Moved");
    }, 20_000);

    it("unlinking keeps the file and the content", async () => {
        const disk = new FakeDisk();
        const handle = await linkNew(disk);
        await ensurePanel();
        const before = disk.read(handle.name);
        fireEvent.click(await screen.findByTestId("linked-file-unlink"));
        await waitFor(() => expect(useResumeStore.getState().linkedFile.status).toBe("none"));
        expect(disk.read(handle.name)).toBe(before);
        expect(useResumeStore.getState().resume.basics.name).toBe("Amina");
        expect(await getLink("cv-1")).toBeUndefined();
    });

    it("is labelled in German", async () => {
        act(() => useI18nStore.setState({ locale: "de", _hydrated: true }));
        installPickers(new FakeDisk());
        render(<LinkedFileControl resumeId="cv-1" />);
        expect(await screen.findByText("Mit einer Datei verknüpfen")).toBeInTheDocument();
        await openPanel();
        expect(screen.getByText("Neue Datei erstellen")).toBeInTheDocument();
        expect(screen.getByText("Vorhandene Datei verwenden")).toBeInTheDocument();
    });
});

describe("LinkedFileControl: opened from the checklist", () => {
    it("opens its panel when asked to", async () => {
        render(<LinkedFileControl resumeId="cv-1" />);
        expect(screen.queryByTestId("linked-file-panel")).not.toBeInTheDocument();
        act(() => { window.dispatchEvent(new Event("enginecv:open-linked-file")); });
        expect(await screen.findByTestId("linked-file-panel")).toBeInTheDocument();
    });
});
