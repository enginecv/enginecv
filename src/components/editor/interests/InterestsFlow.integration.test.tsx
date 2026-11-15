import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InterestsFlow } from "./InterestsFlow";

const interests = [
    { id: "i1", name: "Chess", description: "Club player" },
    { id: "i2", name: "Hiking", description: "" },
    { id: "i3", name: "", description: "No name" },
];

function renderFlow(props: Partial<React.ComponentProps<typeof InterestsFlow>> = {}) {
    return render(
        <InterestsFlow
            interests={interests}
            display="inline"
            separator="dot"
            columns={3}
            showIcons
            fallbackLabel="Interest"
            titleFontSize={11}
            accentColor="#336699"
            itemSpacing={10}
            navSection="interests"
            {...props}
        />,
    );
}

describe("InterestsFlow", () => {
    afterEach(() => cleanup());

    it("renders nothing for an empty list", () => {
        const { container } = renderFlow({ interests: [] });
        expect(container).toBeEmptyDOMElement();
    });

    it("inline: one flowing line with the chosen separator, fallback label for unnamed interests, no descriptions", () => {
        for (const [separator, glyph] of [["dot", "·"], ["comma", ","], ["pipe", "|"], ["slash", "/"]] as const) {
            const { unmount } = renderFlow({ separator });
            const flow = screen.getByTestId("resume-interests-flow");
            expect(flow).toHaveAttribute("data-display", "inline");
            expect(flow.textContent).toContain(`Chess ${glyph} Hiking ${glyph} Interest`);
            expect(flow.textContent).not.toContain("Club player");
            unmount();
        }
    });

    it("chips: one labelled chip per interest, accent coloured", () => {
        renderFlow({ display: "chips" });
        const flow = screen.getByTestId("resume-interests-flow");
        expect(flow).toHaveAttribute("data-display", "chips");
        const chips = within(flow).getAllByTestId("resume-interest-item");
        expect(chips.map((chip) => chip.textContent)).toEqual(["Chess", "Hiking", "Interest"]);
        expect(chips[0].style.borderColor).not.toBe("");
    });

    it("icon grid: columns follow the setting and items without an icon keep their alignment", () => {
        for (const columns of [1, 2, 3, 4]) {
            const { unmount } = renderFlow({
                display: "iconGrid",
                columns,
                renderIcon: (interest) => (interest.name === "Chess" ? <svg data-testid="icon-chess" /> : null),
            });
            const flow = screen.getByTestId("resume-interests-flow");
            expect(flow).toHaveAttribute("data-display", "iconGrid");
            expect(flow.style.gridTemplateColumns).toBe(`repeat(${columns}, minmax(0, 1fr))`);
            const items = within(flow).getAllByTestId("resume-interest-item");
            expect(items).toHaveLength(3);
            // Every cell reserves the icon slot once any interest has an icon.
            for (const item of items) {
                expect(item.querySelector('[data-testid="resume-interest-icon-slot"]')).not.toBeNull();
            }
            expect(within(items[0]).getByTestId("icon-chess")).toBeInTheDocument();
            expect(within(items[1]).queryByTestId("icon-chess")).toBeNull();
            unmount();
        }
    });

    it("icon grid without any icons does not reserve an icon slot", () => {
        renderFlow({ display: "iconGrid", renderIcon: () => null });
        expect(screen.queryAllByTestId("resume-interest-icon-slot")).toHaveLength(0);
    });

    it("hides icons when showIcons is off", () => {
        renderFlow({
            display: "chips",
            showIcons: false,
            renderIcon: () => <svg data-testid="icon-any" />,
        });
        expect(screen.queryByTestId("icon-any")).toBeNull();
    });

    it("tags every item so clicking it targets the right entry", () => {
        renderFlow({ display: "chips" });
        const items = screen.getAllByTestId("resume-interest-item");
        items.forEach((item, index) => {
            expect(item).toHaveAttribute("data-nav-section", "interests");
            expect(item).toHaveAttribute("data-nav-entry-index", String(index));
            expect(item).toHaveAttribute("data-nav-kind", "entry");
        });
    });

    it("marks icons as decorative", () => {
        renderFlow({
            display: "iconGrid",
            renderIcon: () => <svg data-testid="icon-any" />,
        });
        const slot = screen.getAllByTestId("resume-interest-icon-slot")[0];
        expect(slot).toHaveAttribute("aria-hidden", "true");
    });
});
