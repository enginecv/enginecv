import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { ShortcutsOverlay } from "./ShortcutsOverlay";

function setPlatform(platform: string) {
    Object.defineProperty(window.navigator, "platform", {
        value: platform,
        configurable: true,
    });
}

describe("ShortcutsOverlay", () => {
    beforeEach(() => {
        useI18nStore.setState({ locale: "en", _hydrated: true });
        setPlatform("Win32");
    });

    afterEach(() => {
        cleanup();
    });

    it("renders nothing while closed", () => {
        render(<ShortcutsOverlay open={false} onClose={() => {}} />);

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("lists the shortcut groups and their bindings when open", () => {
        render(<ShortcutsOverlay open onClose={() => {}} />);

        expect(screen.getByRole("dialog")).toHaveAccessibleName("Keyboard shortcuts");
        expect(screen.getByText("Moving around the preview")).toBeInTheDocument();
        expect(screen.getByText("Editing a field")).toBeInTheDocument();
        expect(screen.getByText("Bold, italic, underline")).toBeInTheDocument();
        expect(screen.getAllByText("Ctrl+B").length).toBe(1);
    });

    it("renders alternatives as separate key caps around a plain separator", () => {
        const { container } = render(<ShortcutsOverlay open onClose={() => {}} />);

        const caps = Array.from(container.querySelectorAll("kbd")).map((el) => el.textContent);
        expect(caps).toContain("Tab");
        expect(caps).toContain("Shift+Tab");
        expect(caps).not.toContain("/");
    });

    it("uses the macOS bindings on a Mac", () => {
        setPlatform("MacIntel");
        const { container } = render(<ShortcutsOverlay open onClose={() => {}} />);

        const caps = Array.from(container.querySelectorAll("kbd")).map((el) => el.textContent);
        expect(caps).toContain("⌘+B");
        expect(caps).toContain("⌥+Backspace");
        expect(caps).not.toContain("Ctrl+B");
        expect(caps).not.toContain("Ctrl+Backspace");
    });

    it("closes on Escape and on a backdrop click", () => {
        const onClose = vi.fn();
        const { container } = render(<ShortcutsOverlay open onClose={onClose} />);

        fireEvent.keyDown(document, { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(1);

        fireEvent.click(container.querySelector(".backdrop-blur-md")!);
        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it("translates into the active locale", () => {
        useI18nStore.setState({ locale: "de", _hydrated: true });
        render(<ShortcutsOverlay open onClose={() => {}} />);

        expect(screen.getByText("Tastenkürzel")).toBeInTheDocument();
        expect(screen.getByText("Fett, kursiv, unterstrichen")).toBeInTheDocument();
    });
});
