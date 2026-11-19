import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { useClientPreferencesStore } from "@/lib/preferences/store";
import { PreviewViewport } from "./PreviewViewport";

/** A 1000 x 2000 pane, so a 794-wide page fits at scale 1 and the zoom is the scale. */
function paneSize(width = 1000, height = 2000) {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ width, height, x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, toJSON: () => ({}) } as DOMRect);
}

function renderViewport(pageCount = 1) {
    return render(
        <PreviewViewport paperWidth={794} paperHeight={1123} pageCount={pageCount}>
            {(scale) => <div data-testid="page" style={{ zoom: scale, width: 794, height: 1123 }} />}
        </PreviewViewport>,
    );
}

const percent = () => screen.getByTestId("preview-zoom-percent").textContent;
const scaleOf = () => Number((screen.getByTestId("page") as HTMLElement).style.zoom);

describe("PreviewViewport (the CV preview's viewport)", () => {
    beforeEach(() => {
        act(() => {
            useI18nStore.setState({ locale: "en", _hydrated: true });
            useClientPreferencesStore.setState((state) => ({ hydrated: true, preferences: { ...state.preferences, preview: { ...state.preferences.preview, zoom: 1 } } }));
        });
        paneSize();
        // jsdom reports touch support, which the viewport (like the CV preview) treats as a phone: wheel zoom is desktop-only.
        delete (window as unknown as Record<string, unknown>).ontouchstart;
        delete (Window.prototype as unknown as Record<string, unknown>).ontouchstart;
    });
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it("fits the page to the pane: no larger than life, smaller when the pane is narrow", () => {
        renderViewport();
        expect(scaleOf()).toBe(1);
        cleanup();
        paneSize(500, 2000);
        renderViewport();
        expect(scaleOf()).toBeCloseTo((500 - 48) / 794, 2);
    });

    it("zooms in and out by the CV's step and stops at its limits", () => {
        renderViewport();
        expect(percent()).toBe("100%");
        fireEvent.click(screen.getByTestId("preview-zoom-in"));
        expect(percent()).toBe("115%");
        expect(scaleOf()).toBeCloseTo(1.15, 2);
        fireEvent.click(screen.getByTestId("preview-zoom-out"));
        fireEvent.click(screen.getByTestId("preview-zoom-out"));
        expect(percent()).toBe("85%");

        for (let step = 0; step < 10; step++) fireEvent.click(screen.getByTestId("preview-zoom-out"));
        expect(percent()).toBe("50%");
        expect(screen.getByTestId("preview-zoom-out")).toBeDisabled();
        for (let step = 0; step < 30; step++) fireEvent.click(screen.getByTestId("preview-zoom-in"));
        expect(percent()).toBe("300%");
        expect(screen.getByTestId("preview-zoom-in")).toBeDisabled();
    });

    it("zooms with Ctrl or Cmd and the wheel, and leaves a plain wheel to scroll", () => {
        renderViewport();
        const viewport = screen.getByTestId("preview-viewport");
        fireEvent.wheel(viewport, { deltaY: -100 });
        expect(percent()).toBe("100%");
        fireEvent.wheel(viewport, { deltaY: -100, ctrlKey: true });
        expect(percent()).toBe("115%");
        fireEvent.wheel(viewport, { deltaY: 100, metaKey: true });
        expect(percent()).toBe("100%");
    });

    it("shows a reset button only once the view has moved, and puts it back", () => {
        renderViewport();
        expect(screen.queryByTestId("preview-reset-zoom")).toBeNull();
        fireEvent.click(screen.getByTestId("preview-zoom-in"));
        fireEvent.click(screen.getByTestId("preview-reset-zoom"));
        expect(percent()).toBe("100%");
        expect(screen.queryByTestId("preview-reset-zoom")).toBeNull();
    });

    it("remembers the zoom between visits, in the same preference the CV editor uses", () => {
        renderViewport();
        fireEvent.click(screen.getByTestId("preview-zoom-in"));
        expect(useClientPreferencesStore.getState().preferences.preview.zoom).toBe(1.15);
        cleanup();

        renderViewport();
        expect(percent()).toBe("115%");
    });

    it("opens fullscreen from its button and closes it with Escape", () => {
        renderViewport();
        expect(screen.getByTestId("preview-fullscreen")).toHaveAccessibleName("Fullscreen preview");
        fireEvent.click(screen.getByTestId("preview-fullscreen"));
        expect(screen.getByTestId("preview-viewport").className).toContain("fixed inset-0");
        expect(screen.getByTestId("preview-fullscreen")).toHaveAccessibleName(/exit/i);

        fireEvent.keyDown(document, { key: "Escape" });
        expect(screen.getByTestId("preview-viewport").className).not.toContain("fixed inset-0");
    });

    it("closes fullscreen with a click on the backdrop, not on the page", () => {
        renderViewport();
        fireEvent.click(screen.getByTestId("preview-fullscreen"));
        fireEvent.click(screen.getByTestId("page"));
        expect(screen.getByTestId("preview-viewport").className).toContain("fixed inset-0");
        fireEvent.click(screen.getByTestId("preview-viewport"));
        expect(screen.getByTestId("preview-viewport").className).not.toContain("fixed inset-0");
    });

    it("tells the page about a pane that has just got a size, so hidden panes can be re-cut", () => {
        const onResize = vi.fn();
        render(
            <PreviewViewport paperWidth={794} paperHeight={1123} pageCount={1} onResize={onResize}>
                {() => <div />}
            </PreviewViewport>,
        );
        expect(onResize).toHaveBeenCalled();
    });
});
