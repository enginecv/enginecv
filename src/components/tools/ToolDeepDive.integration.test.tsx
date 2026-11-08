import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { getToolProse, TOOL_PROSE_HEADINGS } from "@/lib/tools/prose";
import { TOOL_SLUGS } from "@/lib/tools/registry";
import { ToolDeepDive } from "./ToolDeepDive";

describe("ToolDeepDive", () => {
    afterEach(cleanup);

    it.each(TOOL_SLUGS)("renders the overview, formats, privacy and limits for %s in English", (slug) => {
        const prose = getToolProse(slug)!;
        render(<ToolDeepDive locale="en" slug={slug} />);

        const root = screen.getByTestId("tool-deep-dive");
        expect(within(root).getByRole("heading", { level: 2, name: TOOL_PROSE_HEADINGS.about })).toBeInTheDocument();
        expect(within(root).getByRole("heading", { level: 2, name: prose.formatsHeading })).toBeInTheDocument();
        expect(within(root).getByRole("heading", { level: 2, name: TOOL_PROSE_HEADINGS.privacy })).toBeInTheDocument();
        expect(within(root).getByRole("heading", { level: 2, name: TOOL_PROSE_HEADINGS.limits })).toBeInTheDocument();

        expect(within(root).getByText(prose.overview[0])).toBeInTheDocument();
        for (const format of prose.formats) expect(within(root).getByText(format.name)).toBeInTheDocument();
        expect(within(root).getAllByRole("listitem")).toHaveLength(prose.limits.length);
    });

    it.each(["de", "bs", "fr", "es"] as const)("renders nothing in %s, so those pages stay as they were", (locale) => {
        const { container } = render(<ToolDeepDive locale={locale} slug="europass-to-cv" />);
        expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing for an unknown tool", () => {
        const { container } = render(<ToolDeepDive locale="en" slug="no-such-tool" />);
        expect(container).toBeEmptyDOMElement();
    });

    it("never shows a raw translation key", () => {
        for (const slug of TOOL_SLUGS) {
            const { container, unmount } = render(<ToolDeepDive locale="en" slug={slug} />);
            expect(container.textContent).not.toMatch(/\btools\.[a-z]+\./);
            unmount();
        }
    });
});
