import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import type { Changelog } from "@/lib/changelog/parse";
import { ChangelogContent } from "./ChangelogContent";

vi.mock("next/navigation", () => ({
    usePathname: () => "/changelog",
}));

const LONG_URL = "https://example.com/very/long/unbroken/path/segment/that/would/otherwise/overflow";

const fixtureChangelog: Changelog = {
    unreleased: {
        date: "Unreleased",
        slug: "unreleased",
        groups: [
            {
                category: "Added",
                entries: [{ markdown: "Staged entry awaiting release." }],
            },
        ],
    },
    sections: [
        {
            date: "2026-07-07",
            slug: "2026-07-07",
            groups: [
                {
                    category: "Added",
                    entries: [
                        { markdown: "Skills section with `level` and icons." },
                        { markdown: `Long link entry ${LONG_URL} keeps wrapping.` },
                    ],
                },
                {
                    category: "Fixed",
                    entries: [
                        {
                            markdown:
                                "Preview no longer overflows, see [details](https://github.com/SafetImamovic/EngineCV).",
                        },
                        { markdown: "Entry with markup <script>alert(1)</script> stripped." },
                    ],
                },
            ],
        },
        {
            date: "2026-06-28",
            slug: "2026-06-28",
            groups: [
                {
                    category: "Changed",
                    entries: [{ markdown: "Section Heading editor starts collapsed." }],
                },
            ],
        },
    ],
};

describe("ChangelogContent", () => {
    beforeEach(() => {
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    afterEach(() => {
        cleanup();
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    it("renders sections newest-first with slug anchors", () => {
        const { container } = render(
            <ChangelogContent changelog={fixtureChangelog} showUnreleased={false} />,
        );

        const anchored = Array.from(container.querySelectorAll("section[id]")).map((el) =>
            el.getAttribute("id"),
        );
        expect(anchored).toEqual(["2026-07-07", "2026-06-28"]);
    });

    it("renders groups and entries in file order", () => {
        const { container } = render(
            <ChangelogContent changelog={fixtureChangelog} showUnreleased={false} />,
        );

        const firstSection = container.querySelector("section[id='2026-07-07']")!;
        const headings = Array.from(firstSection.querySelectorAll("h3")).map(
            (el) => el.textContent,
        );
        expect(headings).toEqual(["Added", "Fixed"]);

        const entries = Array.from(firstSection.querySelectorAll("li")).map(
            (el) => el.textContent ?? "",
        );
        expect(entries[0]).toContain("Skills section");
        expect(entries[2]).toContain("Preview no longer overflows");
    });

    it("renders links and inline code from entry markdown", () => {
        render(<ChangelogContent changelog={fixtureChangelog} showUnreleased={false} />);

        const link = screen.getByRole("link", { name: "details" });
        expect(link).toHaveAttribute("href", "https://github.com/SafetImamovic/EngineCV");
        expect(document.querySelector("li code")).toHaveTextContent("level");
    });

    it("strips disallowed markup instead of rendering it raw", () => {
        const { container } = render(
            <ChangelogContent changelog={fixtureChangelog} showUnreleased={false} />,
        );

        expect(container.querySelector("script")).toBeNull();
        expect(container.innerHTML).not.toContain("<script>");
    });

    it("applies wrapping classes so long unbroken strings cannot overflow", () => {
        const { container } = render(
            <ChangelogContent changelog={fixtureChangelog} showUnreleased={false} />,
        );

        const entryList = container.querySelector("li");
        expect(entryList?.className).toMatch(/break-words/);
    });

    it("hides the Unreleased section when showUnreleased is false", () => {
        render(<ChangelogContent changelog={fixtureChangelog} showUnreleased={false} />);

        expect(screen.queryByText("Staged entry awaiting release.")).toBeNull();
    });

    it("shows the Unreleased section when showUnreleased is true", () => {
        render(<ChangelogContent changelog={fixtureChangelog} showUnreleased={true} />);

        expect(screen.getByText("Staged entry awaiting release.")).toBeInTheDocument();
    });

    it("renders translated chrome in English", () => {
        render(<ChangelogContent changelog={fixtureChangelog} showUnreleased={false} />);

        expect(screen.getByRole("heading", { level: 1, name: "Changelog" })).toBeInTheDocument();
        expect(
            screen.getByText("Every user-facing change to EngineCV, straight from the repository."),
        ).toBeInTheDocument();
    });

    it("renders translated chrome in Bosnian", () => {
        useI18nStore.setState({ locale: "bs", _hydrated: true });

        render(<ChangelogContent changelog={fixtureChangelog} showUnreleased={false} />);

        expect(
            screen.getByRole("heading", { level: 1, name: "Dnevnik promjena" }),
        ).toBeInTheDocument();
        expect(
            screen.getByText("Sve vidljive promjene u EngineCV-u, direktno iz repozitorija."),
        ).toBeInTheDocument();
    });
});
