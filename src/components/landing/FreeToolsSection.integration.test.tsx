import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { getEnabledTools } from "@/lib/tools/registry";
import { FreeToolsSection } from "./FreeToolsSection";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}));

describe("FreeToolsSection", () => {
    beforeEach(() => useI18nStore.setState({ locale: "en", _hydrated: true }));
    afterEach(cleanup);

    it("links every enabled tool, the examples and the tools index", () => {
        render(<FreeToolsSection />);

        const section = screen.getByTestId("landing-free-tools");
        const hrefs = within(section).getAllByRole("link").map((link) => link.getAttribute("href"));
        for (const tool of getEnabledTools()) expect(hrefs).toContain(`/tools/${tool.slug}`);
        expect(hrefs).toContain("/cv-examples");
        expect(hrefs).toContain("/tools");
        expect(screen.getByRole("heading", { level: 2, name: "Start from what you already have" })).toBeInTheDocument();
    });

    it("prefixes links in a translated locale", () => {
        useI18nStore.setState({ locale: "de", _hydrated: true });
        render(<FreeToolsSection />);

        const hrefs = within(screen.getByTestId("landing-free-tools")).getAllByRole("link").map((link) => link.getAttribute("href"));
        expect(hrefs).toContain("/de/tools");
        expect(hrefs).toContain("/de/tools/europass-to-cv");
    });
});
