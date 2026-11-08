import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { FontImportButton } from "./CustomizeSidebar";

describe("FontImportButton", () => {
    beforeEach(() => {
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    afterEach(() => {
        cleanup();
    });

    it("explains that pasted fonts load from their own address, linked to the URL field", async () => {
        const user = userEvent.setup();
        render(<FontImportButton onImport={vi.fn()} />);

        await user.click(screen.getByRole("button", { name: "Import Custom Font" }));

        const input = screen.getByLabelText("Paste Google Font URL");
        const note = screen.getByTestId("custom-font-privacy-note");
        expect(note).toHaveTextContent("Google Fonts links load from Google, which receives your IP address.");
        expect(input).toHaveAttribute("aria-describedby", note.id);
    });

    it("adds the font family parsed from a Google Fonts URL", async () => {
        const user = userEvent.setup();
        const onImport = vi.fn();
        render(<FontImportButton onImport={onImport} />);

        await user.click(screen.getByRole("button", { name: "Import Custom Font" }));
        await user.type(screen.getByLabelText("Paste Google Font URL"), "https://fonts.googleapis.com/css2?family=Open+Sans:wght@400");
        await user.click(screen.getByRole("button", { name: "Add" }));

        expect(onImport).toHaveBeenCalledWith("Open Sans", "https://fonts.googleapis.com/css2?family=Open+Sans:wght@400");
    });

    it("shows the note in a non-default locale", async () => {
        const user = userEvent.setup();
        act(() => useI18nStore.setState({ locale: "de", _hydrated: true }));
        render(<FontImportButton onImport={vi.fn()} />);

        await user.click(screen.getByRole("button", { name: "Eigene Schriftart importieren" }));

        expect(screen.getByTestId("custom-font-privacy-note")).toHaveTextContent("Google-Fonts-Links laden von Google");
    });
});
