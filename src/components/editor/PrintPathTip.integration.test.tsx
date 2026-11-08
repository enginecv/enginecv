import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { DEFAULT_CLIENT_PREFERENCES } from "@/lib/preferences/schema";
import { useExportSupportPromptStore } from "@/lib/preferences/export-support";
import { useClientPreferencesStore } from "@/lib/preferences/store";
import { createEmptyResume } from "@/lib/schema";
import { ExportDialog } from "./ExportMenu";
import { PrintPathTip } from "./PrintPathTip";

const mocks = vi.hoisted(() => ({ runResumeExport: vi.fn() }));

vi.mock("@/lib/resume-export", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/resume-export")>();
    return { ...actual, runResumeExport: mocks.runResumeExport };
});

vi.mock("@/lib/export", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/export")>();
    return { ...actual, hasPreviewPages: () => true };
});

function desktop() {
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
}

function resetPreferences() {
    localStorage.clear();
    useClientPreferencesStore.setState({ preferences: DEFAULT_CLIENT_PREFERENCES, hydrated: false });
    useExportSupportPromptStore.setState({ visible: false });
}

describe("PrintPathTip", () => {
    beforeEach(() => {
        resetPreferences();
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    afterEach(() => {
        cleanup();
        resetPreferences();
    });

    it("explains the print dialog until dismissed, then stays one click away", () => {
        render(<PrintPathTip />);

        expect(screen.getByTestId("print-tip")).toHaveTextContent("Save as PDF");
        expect(screen.getByTestId("print-tip")).toHaveTextContent("Microsoft Print to PDF");
        expect(document.activeElement).toBe(document.body);

        fireEvent.click(screen.getByTestId("print-tip-dismiss"));

        expect(useClientPreferencesStore.getState().preferences.onboarding.printTipSeen).toBe(true);
        const toggle = screen.getByTestId("print-tip-toggle");
        expect(toggle).toHaveFocus();
        expect(toggle).toHaveAttribute("aria-expanded", "false");
        expect(screen.queryByTestId("print-tip")).not.toBeInTheDocument();

        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute("aria-expanded", "true");
        expect(screen.getByTestId("print-tip")).toHaveTextContent("Save as PDF");
    });
});

describe("ExportDialog print tip", () => {
    beforeEach(() => {
        resetPreferences();
        desktop();
        useI18nStore.setState({ locale: "en", _hydrated: true });
        mocks.runResumeExport.mockReset().mockResolvedValue({ notices: [] });
    });

    afterEach(() => {
        cleanup();
        resetPreferences();
    });

    it("shows the tip for PDF only", () => {
        render(<ExportDialog open onClose={vi.fn()} resume={createEmptyResume()} paperSize="a4" />);

        fireEvent.click(screen.getByTestId("export-format-pdf"));
        expect(screen.getByTestId("print-tip")).toBeInTheDocument();

        fireEvent.click(screen.getByTestId("export-format-docx"));
        expect(screen.queryByTestId("print-tip")).not.toBeInTheDocument();
        expect(screen.queryByTestId("print-tip-toggle")).not.toBeInTheDocument();
    });

    it("collapses after the first PDF export and keeps the Ko-fi card", async () => {
        const onClose = vi.fn();
        render(<ExportDialog open onClose={onClose} resume={createEmptyResume()} paperSize="a4" />);
        fireEvent.click(screen.getByTestId("export-format-pdf"));
        fireEvent.click(screen.getByTestId("export-confirm-button"));

        await waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(mocks.runResumeExport).toHaveBeenCalledWith(expect.objectContaining({ format: "pdf" }));
        expect(useClientPreferencesStore.getState().preferences.onboarding.printTipSeen).toBe(true);
        expect(useExportSupportPromptStore.getState().visible).toBe(true);
    });

    it("stays expanded when a PDF export fails", async () => {
        mocks.runResumeExport.mockRejectedValue(new Error("Popup blocked"));
        render(<ExportDialog open onClose={vi.fn()} resume={createEmptyResume()} paperSize="a4" />);
        fireEvent.click(screen.getByTestId("export-format-pdf"));
        fireEvent.click(screen.getByTestId("export-confirm-button"));

        expect(await screen.findByText("Popup blocked")).toBeInTheDocument();
        expect(useClientPreferencesStore.getState().preferences.onboarding.printTipSeen).toBe(false);
        expect(screen.getByTestId("print-tip-dismiss")).toBeInTheDocument();
    });
});
