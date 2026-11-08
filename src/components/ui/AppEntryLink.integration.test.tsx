import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { RouteLocaleProvider } from "@/lib/i18n/route-locale";
import { AppEntryLink } from "./AppEntryLink";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ prefetch: vi.fn() }),
}));

describe("AppEntryLink", () => {
    beforeEach(() => {
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    afterEach(() => {
        cleanup();
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    it("stores the page's language when the visitor opens the app from a localized page", () => {
        const onClick = vi.fn();
        render(
            <RouteLocaleProvider locale="de">
                <AppEntryLink href="/dashboard" onClick={onClick}>Start</AppEntryLink>
            </RouteLocaleProvider>,
        );

        // Clicking a Next link navigates; only the click side effect matters here.
        const link = screen.getByRole("link", { name: "Start" });
        link.addEventListener("click", (event) => event.preventDefault());
        fireEvent.click(link);

        expect(useI18nStore.getState().locale).toBe("de");
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("leaves the stored language alone on pages without a locale prefix", () => {
        useI18nStore.setState({ locale: "fr", _hydrated: true });
        render(<AppEntryLink href="/dashboard">Start</AppEntryLink>);

        const link = screen.getByRole("link", { name: "Start" });
        link.addEventListener("click", (event) => event.preventDefault());
        fireEvent.click(link);

        expect(useI18nStore.getState().locale).toBe("fr");
    });
});
