import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { useResumeStore } from "@/lib/store";
import { seededAdapters } from "@/lib/storage-registry/__fixtures__/adapters";
import type { DeletionResult } from "@/lib/storage-registry/wipe";
import DeleteAllDataDialog from "./DeleteAllDataDialog";
import { WipeListener } from "./WipeListener";

const wipe = vi.hoisted(() => ({
    calls: 0,
    result: { status: "complete", remaining: [], serverClear: "ok", mayRemain: [] } as DeletionResult,
    downloads: 0,
    listener: null as null | { onStart: () => void; onDone: () => void },
}));

vi.mock("@/lib/storage-registry/inventory", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/storage-registry/inventory")>();
    return { ...actual, collectInventory: () => actual.collectInventory(seededAdapters()) };
});
vi.mock("@/lib/storage-registry/wipe", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/storage-registry/wipe")>();
    return {
        ...actual,
        wipeAllData: async (options: { onStep?: (step: string) => void }) => {
            wipe.calls += 1;
            options.onStep?.("database");
            return wipe.result;
        },
    };
});
vi.mock("@/lib/export", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/export")>();
    return { ...actual, downloadBlob: () => { wipe.downloads += 1; } };
});
vi.mock("@/lib/storage-registry/cross-tab", () => ({
    listenForWipe: (handlers: { onStart: () => void; onDone: () => void }) => {
        wipe.listener = handlers;
        return () => {};
    },
    announceWipe: () => {},
}));

function confirmButton() {
    return screen.getByRole("button", { name: "Delete everything" }) as HTMLButtonElement;
}

describe("Delete all my data dialog", () => {
    beforeEach(() => {
        wipe.calls = 0;
        wipe.downloads = 0;
        wipe.result = { status: "complete", remaining: [], serverClear: "ok", mayRemain: [] };
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    it("shows what will go and stays locked until DELETE is typed", async () => {
        render(<DeleteAllDataDialog open onClose={() => {}} />);
        expect(await screen.findByText("3 CVs")).toBeTruthy();
        expect(confirmButton().disabled).toBe(true);

        fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), { target: { value: "DELET" } });
        expect(confirmButton().disabled).toBe(true);
        fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), { target: { value: "delete" } });
        expect(confirmButton().disabled).toBe(false);

        fireEvent.click(confirmButton());
        expect(await screen.findByText("Everything is deleted.")).toBeTruthy();
        expect(wipe.calls).toBe(1);
    });

    it("accepts the word in the user's language", async () => {
        useI18nStore.setState({ locale: "de", _hydrated: true });
        render(<DeleteAllDataDialog open onClose={() => {}} />);
        const field = await screen.findByLabelText("Zum Bestätigen LÖSCHEN eingeben");
        fireEvent.change(field, { target: { value: "löschen" } });
        expect((screen.getByRole("button", { name: "Alles löschen" }) as HTMLButtonElement).disabled).toBe(false);
    });

    it("deletes after holding the button for two seconds, not before", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        render(<DeleteAllDataDialog open onClose={() => {}} />);
        const hold = await screen.findByTestId("hold-to-delete");

        fireEvent.pointerDown(hold);
        act(() => vi.advanceTimersByTime(1000));
        fireEvent.pointerUp(hold);
        expect(wipe.calls).toBe(0);

        fireEvent.pointerDown(hold);
        act(() => vi.advanceTimersByTime(2100));
        await waitFor(() => expect(wipe.calls).toBe(1));
    });

    it("downloads a copy first without closing", async () => {
        const onClose = vi.fn();
        render(<DeleteAllDataDialog open onClose={onClose} />);
        fireEvent.click(await screen.findByRole("button", { name: "Download my data first" }));
        await waitFor(() => expect(wipe.downloads).toBe(1));
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByTestId("delete-all-data-dialog")).toBeTruthy();
    });

    it("lists what is left after a partial delete and offers a retry", async () => {
        wipe.result = {
            status: "partial",
            remaining: [{ location: "indexeddb-database", name: "EngineCVDatabase", reason: "blocked" }],
            serverClear: "offline",
            mayRemain: [],
        };
        render(<DeleteAllDataDialog open onClose={() => {}} />);
        fireEvent.change(await screen.findByLabelText("Type DELETE to confirm"), { target: { value: "DELETE" } });
        fireEvent.click(confirmButton());

        expect(await screen.findByText(/Close other EngineCV tabs and try again/)).toBeTruthy();
        expect(screen.getByText(/You are offline/)).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Try again" }));
        await waitFor(() => expect(wipe.calls).toBe(2));
    });
});

describe("WipeListener", () => {
    afterEach(cleanup);

    it("stops saving and shows a notice when another tab starts deleting", async () => {
        useResumeStore.setState({ persistenceSuspended: false, autoSaveEnabled: true });
        render(<WipeListener />);
        act(() => wipe.listener?.onStart());

        expect(await screen.findByTestId("other-tab-wipe-notice")).toBeTruthy();
        await waitFor(() => expect(useResumeStore.getState().persistenceSuspended).toBe(true));
    });
});
