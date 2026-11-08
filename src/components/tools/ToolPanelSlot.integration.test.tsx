import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { RouteLocaleProvider } from "@/lib/i18n/route-locale";
import type { ToolPanelId } from "@/lib/tools/registry";
import type { ToolPanelProps } from "./ToolPanelSlot";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: pushMock }),
}));

// Stand-in panel that finishes as soon as it is clicked.
vi.mock("next/dynamic", () => ({
    default: () => function FakePanel({ onDone }: ToolPanelProps) {
        return <button type="button" onClick={() => onDone("resume-7")}>finish</button>;
    },
}));

const { ToolPanelSlot } = await import("./ToolPanelSlot");

function setOnline(value: boolean) {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => value });
    window.dispatchEvent(new Event(value ? "online" : "offline"));
}

describe("ToolPanelSlot", () => {
    beforeEach(() => {
        pushMock.mockClear();
        useI18nStore.setState({ locale: "en", _hydrated: true });
        setOnline(true);
    });

    afterEach(cleanup);

    it("stores the page's language before opening the editor", () => {
        render(
            <RouteLocaleProvider locale="de">
                <ToolPanelSlot panel="europass" worksOffline labelledBy="t" />
            </RouteLocaleProvider>,
        );

        act(() => screen.getByRole("button", { name: "finish" }).click());

        expect(useI18nStore.getState().locale).toBe("de");
        expect(pushMock).toHaveBeenCalledWith("/editor/resume-7");
    });

    it("warns offline only for tools that need the network", () => {
        const { rerender } = render(<ToolPanelSlot panel="europass" worksOffline={false} labelledBy="t" />);
        expect(screen.queryByTestId("tool-offline-notice")).not.toBeInTheDocument();

        act(() => setOnline(false));
        expect(screen.getByTestId("tool-offline-notice")).toBeInTheDocument();

        rerender(<ToolPanelSlot panel="europass" worksOffline labelledBy="t" />);
        expect(screen.queryByTestId("tool-offline-notice")).not.toBeInTheDocument();

        act(() => setOnline(true));
    });

    it("shows the loading state for a panel that is not registered yet", () => {
        render(<ToolPanelSlot panel={"not-yet" as ToolPanelId} worksOffline labelledBy="t" />);
        expect(screen.getByTestId("tool-panel-loading")).toHaveTextContent("Loading the tool");
    });
});
