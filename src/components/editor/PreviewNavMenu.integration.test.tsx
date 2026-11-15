import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { PreviewNavMenu } from "./PreviewNavMenu";

describe("PreviewNavMenu", () => {
    beforeEach(() => {
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });
    afterEach(() => cleanup());

    function renderMenu(props: Partial<React.ComponentProps<typeof PreviewNavMenu>> = {}) {
        const handlers = { onGo: vi.fn(), onCustomize: vi.fn(), onClose: vi.fn() };
        render(<PreviewNavMenu x={40} y={40} kind="heading" {...handlers} {...props} />);
        return handlers;
    }

    it("shows Go to section and Customize section but no Open link by default", () => {
        renderMenu();
        expect(screen.getByRole("button", { name: "Go to section" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Customize section" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Open link" })).not.toBeInTheDocument();
    });

    it("shows Open link only when opened from a link and calls its handler", () => {
        const onOpenLink = vi.fn();
        renderMenu({ onOpenLink });

        fireEvent.click(screen.getByRole("button", { name: "Open link" }));

        expect(onOpenLink).toHaveBeenCalledTimes(1);
    });

    it("keeps the entry wording for entries and closes on Escape", () => {
        const { onClose } = renderMenu({ kind: "entry", onOpenLink: vi.fn() });
        expect(screen.getByRole("button", { name: "Go to entry" })).toBeInTheDocument();

        fireEvent.keyDown(window, { key: "Escape" });

        expect(onClose).toHaveBeenCalled();
    });

    it("uses translated labels and a minimum-width container so longer text does not clip", () => {
        useI18nStore.setState({ locale: "de", _hydrated: true });
        renderMenu({ onOpenLink: vi.fn() });

        const open = screen.getByRole("button", { name: "Link öffnen" });
        expect(open).toBeInTheDocument();
        // The panel only sets a minimum width, so longer German labels can grow it.
        const panel = open.parentElement as HTMLElement;
        expect(panel.className).toContain("min-w-");
        expect(panel.className).not.toMatch(/(^|\s)(w-|max-w-)/);
    });
});
