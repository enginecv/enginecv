import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getGithubSponsorsUrl, getKofiUrl } from "@/lib/support";
import { orderedSupporters } from "@/lib/supporters";
import SupportersPage from "./page";

vi.mock("next/navigation", () => ({
    usePathname: () => "/supporters",
    useRouter: () => ({ prefetch: vi.fn() }),
}));

describe("SupportersPage", () => {
    afterEach(() => {
        cleanup();
    });

    it("links to Ko-fi through the supporters placement", () => {
        render(<SupportersPage />);

        expect(screen.getByRole("heading", { level: 1, name: "Thank you" })).toBeInTheDocument();
        expect(within(screen.getByRole("main")).getByRole("link", { name: /Support EngineCV on Ko-fi/ })).toHaveAttribute(
            "href",
            getKofiUrl("supporters"),
        );
    });

    it("hides GitHub Sponsors until the flag is on", () => {
        render(<SupportersPage />);

        expect(screen.queryByRole("link", { name: /Sponsor on GitHub/ })).not.toBeInTheDocument();
    });

    it("links to GitHub Sponsors through the supporters placement when enabled", () => {
        vi.stubEnv("NEXT_PUBLIC_GITHUB_SPONSORS_ENABLED", "true");
        try {
            render(<SupportersPage />);

            expect(within(screen.getByRole("main")).getByRole("link", { name: /Sponsor on GitHub/ })).toHaveAttribute(
                "href",
                getGithubSponsorsUrl("supporters"),
            );
        } finally {
            vi.unstubAllEnvs();
        }
    });
});

describe("orderedSupporters", () => {
    it("lists monthly supporters first and keeps the rest in order", () => {
        expect(
            orderedSupporters([{ name: "A" }, { name: "B", monthly: true }, { name: "C" }]).map((s) => s.name),
        ).toEqual(["B", "A", "C"]);
    });
});
