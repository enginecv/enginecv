import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { useI18nStore } from "@/lib/i18n";
import { makeLetter, resetLetterTables } from "../../../test/setup/letter-fixtures";
import { createMemoryDirectory } from "../../../test/setup/memory-directory";
import { cvFileText, editFile, makeWorkspaceCv } from "../../../test/setup/workspace-fixtures";

let folder = createMemoryDirectory("applications");
let supported = true;
const STAND_IN = { kind: "directory", name: "applications" } as unknown as FileSystemDirectoryHandle;
vi.mock("@/lib/workspace/directory-adapter", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/workspace/directory-adapter")>();
    return {
        ...actual,
        isWorkspaceSupported: () => supported,
        pickWorkspaceFolder: async () => STAND_IN,
        createDirectoryAdapter: () => actual.createDirectoryAdapter(folder.root as unknown as FileSystemDirectoryHandle),
    };
});
vi.mock("@/lib/workspace/leader", () => ({
    createLeader: () => ({ start() {}, stop() {}, isLeader: true, onChange: (listener: (value: boolean) => void) => { listener(true); return () => undefined; }, nudge() {}, onNudge: () => () => undefined }),
}));

async function mount() {
    const { WorkspacePanel } = await import("./WorkspacePanel");
    const controller = await import("@/lib/workspace/controller");
    await controller.initWorkspace();
    render(<WorkspacePanel onClose={vi.fn()} />);
    return controller;
}

describe("WorkspacePanel", () => {
    beforeEach(async () => {
        (await import("@/lib/workspace/controller")).resetWorkspaceController();
        folder = createMemoryDirectory("applications");
        supported = true;
        await resetLetterTables();
        await db.workspace.clear();
        await db.workspaceDocs.clear();
        await db.resumes.put(makeWorkspaceCv({ id: "cv-1", title: "Master CV" }));
        await db.coverLetters.put(makeLetter({ id: "l-1", cvId: "cv-1", company: "Acme" }));
        act(() => useI18nStore.setState({ locale: "en", _hydrated: true }));
    });
    afterEach(async () => {
        cleanup();
        (await import("@/lib/workspace/controller")).resetWorkspaceController();
    });

    it("says plainly why it is unavailable on an unsupported browser", async () => {
        supported = false;
        await mount();
        expect(await screen.findByTestId("workspace-unsupported")).toHaveTextContent(/Chrome, Edge/);
        expect(screen.queryByTestId("workspace-choose")).toBeNull();
    });

    it("walks through the warning, the review and the setup", async () => {
        await mount();
        fireEvent.click(await screen.findByTestId("workspace-choose"));
        const warning = await screen.findByTestId("workspace-warning");
        expect(warning).toHaveTextContent(/personal details/);
        fireEvent.click(within(warning).getByTestId("workspace-warning-continue"));

        const review = await screen.findByTestId("workspace-first-sync");
        // A fresh folder has nothing that disagrees, so nothing needs a look before applying.
        expect(within(review).getAllByTestId(/^workspace-sync-row-/)).toHaveLength(2);
        expect(within(review).getByTestId("workspace-first-sync-apply")).toBeEnabled();
        fireEvent.click(within(review).getByTestId("workspace-first-sync-apply"));

        await waitFor(() => expect(screen.getByTestId("workspace-phase-connected")).toBeInTheDocument());
        expect(screen.getByTestId("workspace-folder-name")).toHaveTextContent("applications");
        expect(screen.getByTestId("workspace-doc-count")).toHaveTextContent("2 documents");
        expect(await folder.readExternal("AGENTS.md")).not.toBeNull();
    });

    it("leaves contact details out when the box is ticked", async () => {
        await mount();
        fireEvent.click(await screen.findByTestId("workspace-choose"));
        fireEvent.click(within(await screen.findByTestId("workspace-warning")).getByTestId("workspace-warning-hide"));
        fireEvent.click(screen.getByTestId("workspace-warning-continue"));
        fireEvent.click(await screen.findByTestId("workspace-first-sync-apply"));
        await screen.findByTestId("workspace-phase-connected");
        expect(await folder.readExternal("cvs/Master CV.cv.json")).not.toContain("amina@example.com");
    });

    it("keeps Apply disabled until a disagreement has been looked at, and defaults to keeping the app's version", async () => {
        const edited = editFile(cvFileText(makeWorkspaceCv({ id: "cv-1", title: "Master CV" })), (doc) => {
            (doc.basics as Record<string, unknown>).headline = "From an agent";
        });
        await folder.writeExternal("cvs/Master CV.cv.json", edited);
        await mount();
        fireEvent.click(await screen.findByTestId("workspace-choose"));
        fireEvent.click(await screen.findByTestId("workspace-warning-continue"));
        const review = await screen.findByTestId("workspace-first-sync");
        const row = within(review).getByTestId("workspace-sync-row-pair:cv-1");
        expect(within(row).getByTestId("workspace-sync-status-pair:cv-1")).toHaveTextContent("Different");
        expect(within(row).getByTestId("workspace-sync-choice-pair:cv-1")).toHaveValue("keep-app");
        expect(within(review).getByTestId("workspace-first-sync-apply")).toBeDisabled();
        fireEvent.click(within(review).getByTestId("workspace-first-sync-reviewed"));
        expect(within(review).getByTestId("workspace-first-sync-apply")).toBeEnabled();
    });

    it("cancelling at any step writes nothing", async () => {
        await mount();
        fireEvent.click(await screen.findByTestId("workspace-choose"));
        fireEvent.click(await screen.findByTestId("workspace-warning-cancel"));
        expect(screen.queryByTestId("workspace-warning")).toBeNull();
        fireEvent.click(screen.getByTestId("workspace-choose"));
        fireEvent.click(await screen.findByTestId("workspace-warning-continue"));
        fireEvent.click(await screen.findByTestId("workspace-first-sync-cancel"));
        expect(await folder.listExternal("")).toEqual([]);
        expect(await db.workspace.count()).toBe(0);
    });

    it("asks to resume after the browser wants permission again, and disconnects without touching files", async () => {
        const controller = await mount();
        fireEvent.click(await screen.findByTestId("workspace-choose"));
        fireEvent.click(await screen.findByTestId("workspace-warning-continue"));
        fireEvent.click(await screen.findByTestId("workspace-first-sync-apply"));
        await screen.findByTestId("workspace-phase-connected");

        cleanup();
        controller.resetWorkspaceController();
        folder.setPermission("prompt", "granted");
        await mount();
        expect(await screen.findByTestId("workspace-needs-permission")).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("workspace-resume-permission"));
        await screen.findByTestId("workspace-phase-connected");

        const before = await folder.listExternal("cvs");
        fireEvent.click(screen.getByTestId("workspace-disconnect"));
        fireEvent.click(await screen.findByRole("button", { name: "Disconnect", hidden: false }).then((b) => b).catch(() => screen.getAllByRole("button", { name: "Disconnect" })[1]));
        await waitFor(() => expect(screen.getByTestId("workspace-phase-none")).toBeInTheDocument());
        expect(await folder.listExternal("cvs")).toEqual(before);
        expect(await db.resumes.count()).toBe(1);
    });
});
