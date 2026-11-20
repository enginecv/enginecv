import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { WorkspaceSection } from "./WorkspaceSection";

vi.mock("next/navigation", () => ({
    usePathname: () => "/",
    useRouter: () => ({ prefetch: vi.fn(), push: vi.fn() }),
}));

describe("WorkspaceSection", () => {
    beforeEach(() => act(() => useI18nStore.setState({ locale: "en", _hydrated: true })));
    afterEach(cleanup);

    it("leads with the folder idea, shows the three parties and four actions, and links to the full page", () => {
        render(<WorkspaceSection />);
        expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Your CVs as files an AI agent can edit");
        expect(within(screen.getByTestId("landing-workspace-flow"))).toBeTruthy();
        expect(screen.getByTestId("landing-workspace-flow")).toHaveTextContent("Your folder");
        expect(screen.getAllByRole("listitem")).toHaveLength(4);
        expect(screen.getByTestId("landing-workspace-how")).toHaveAttribute("href", "/how-it-works");
        expect(screen.getByText(/Nothing is uploaded/)).toBeInTheDocument();
    });

    it.each(["de", "bs", "fr", "es"] as const)("is translated in %s with no missing text", (locale) => {
        act(() => useI18nStore.setState({ locale, _hydrated: true }));
        render(<WorkspaceSection />);
        expect(document.body.textContent).not.toMatch(/landing\.workspace\./);
        expect(screen.getByRole("heading", { level: 2 }).textContent).not.toBe("Your CVs as files an AI agent can edit");
    });
});

import { within } from "@testing-library/react";
