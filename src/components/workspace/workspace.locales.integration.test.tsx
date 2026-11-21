import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { useI18nStore } from "@/lib/i18n";
import { makeLetter, resetLetterTables } from "../../../test/setup/letter-fixtures";
import { createMemoryDirectory } from "../../../test/setup/memory-directory";
import { makeWorkspaceCv } from "../../../test/setup/workspace-fixtures";

// The workspace panel in a language other than English: every step is translated, no key shows through,
// and nothing falls back to the English text. (Narrow-width overflow needs a real layout: e2e/workspace.spec.ts.)

let folder = createMemoryDirectory("applications");
const STAND_IN = { kind: "directory", name: "applications" } as unknown as FileSystemDirectoryHandle;
vi.mock("@/lib/workspace/directory-adapter", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/workspace/directory-adapter")>();
    return {
        ...actual,
        isWorkspaceSupported: () => true,
        pickWorkspaceFolder: async () => STAND_IN,
        createDirectoryAdapter: () => actual.createDirectoryAdapter(folder.root as unknown as FileSystemDirectoryHandle),
    };
});
vi.mock("@/lib/workspace/leader", () => ({
    createLeader: () => ({ start() {}, stop() {}, isLeader: true, onChange: (listener: (value: boolean) => void) => { listener(true); return () => undefined; }, nudge() {}, onNudge: () => () => undefined }),
}));

const EXPECTED = {
    de: { warning: "persönliche Angaben", documents: "2 Dokumente im Ordner" },
    bs: { warning: "lične podatke", documents: "2 dokumenata u mapi" },
} as const;

/** A translation key shown instead of text, like "workspace.panel.documents". */
const RAW_KEY = /\bworkspace\.[a-zA-Z]+\.[a-zA-Z.]+/;

async function mount() {
    const { WorkspacePanel } = await import("./WorkspacePanel");
    const controller = await import("@/lib/workspace/controller");
    await controller.initWorkspace();
    render(<WorkspacePanel onClose={vi.fn()} />);
}

describe.each(["de", "bs"] as const)("workspace panel in %s", (locale) => {
    beforeEach(async () => {
        (await import("@/lib/workspace/controller")).resetWorkspaceController();
        folder = createMemoryDirectory("applications");
        await resetLetterTables();
        await db.workspace.clear();
        await db.workspaceDocs.clear();
        await db.resumes.put(makeWorkspaceCv({ id: "cv-1", title: "Master CV" }));
        await db.coverLetters.put(makeLetter({ id: "l-1", cvId: "cv-1", company: "Acme" }));
        act(() => useI18nStore.setState({ locale, _hydrated: true }));
    });
    afterEach(async () => {
        cleanup();
        (await import("@/lib/workspace/controller")).resetWorkspaceController();
    });

    it("translates the warning, the first-sync review and the connected panel", async () => {
        await mount();
        expect(document.body.textContent).not.toMatch(RAW_KEY);

        fireEvent.click(await screen.findByTestId("workspace-choose"));
        const warning = await screen.findByTestId("workspace-warning");
        expect(warning).toHaveTextContent(EXPECTED[locale].warning);
        expect(warning.textContent).not.toMatch(RAW_KEY);
        expect(warning).not.toHaveTextContent("personal details");
        fireEvent.click(within(warning).getByTestId("workspace-warning-continue"));

        const review = await screen.findByTestId("workspace-first-sync");
        expect(review.textContent).not.toMatch(RAW_KEY);
        expect(review).not.toHaveTextContent("Apply");
        fireEvent.click(within(review).getByTestId("workspace-first-sync-apply"));

        const connected = await screen.findByTestId("workspace-phase-connected");
        expect(screen.getByTestId("workspace-doc-count")).toHaveTextContent(EXPECTED[locale].documents);
        expect(connected.textContent).not.toMatch(RAW_KEY);
        expect(connected.textContent).not.toMatch(/documents in the folder|Disconnect|Check now/);

        // The disconnect confirmation is a dialog of its own.
        fireEvent.click(screen.getByTestId("workspace-disconnect"));
        expect(document.body.textContent).not.toMatch(RAW_KEY);
    });
});
