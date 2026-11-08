import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { useExportSupportPromptStore } from "@/lib/preferences/export-support";
import { DEFAULT_CLIENT_PREFERENCES } from "@/lib/preferences/schema";
import { useClientPreferencesStore } from "@/lib/preferences/store";
import { getKofiUrl } from "@/lib/support";
import { ExportSupportCard } from "./ExportSupportCard";

describe("ExportSupportCard", () => {
    beforeEach(() => {
        localStorage.clear();
        useI18nStore.setState({ locale: "en" });
        useClientPreferencesStore.setState({ preferences: DEFAULT_CLIENT_PREFERENCES, hydrated: false });
        useExportSupportPromptStore.setState({ visible: false });
    });

    afterEach(() => {
        cleanup();
        localStorage.clear();
    });

    it("renders nothing until an export milestone shows it", () => {
        render(<ExportSupportCard />);

        expect(screen.queryByTestId("export-support-card")).toBeNull();
    });

    it("shows the Ko-fi export placement without taking focus", () => {
        render(<ExportSupportCard />);
        const before = document.activeElement;

        act(() => useExportSupportPromptStore.getState().show());

        expect(screen.getByRole("link", { name: "Buy me a coffee on Ko-fi" })).toHaveAttribute(
            "href",
            getKofiUrl("export"),
        );
        expect(document.activeElement).toBe(before);
    });

    it("persists 'Don't show again'", () => {
        render(<ExportSupportCard />);
        act(() => useExportSupportPromptStore.getState().show());

        fireEvent.click(screen.getByTestId("export-support-dismiss"));

        expect(screen.queryByTestId("export-support-card")).toBeNull();
        expect(useClientPreferencesStore.getState().preferences.support.exportPromptDismissed).toBe(true);
    });

    it("closes without dismissing for good", () => {
        render(<ExportSupportCard />);
        act(() => useExportSupportPromptStore.getState().show());

        fireEvent.click(screen.getByRole("button", { name: "Close" }));

        expect(screen.queryByTestId("export-support-card")).toBeNull();
        expect(useClientPreferencesStore.getState().preferences.support.exportPromptDismissed).toBe(false);
    });
});
