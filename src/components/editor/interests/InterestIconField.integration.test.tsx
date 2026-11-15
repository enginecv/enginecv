import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { InterestIconField } from "./InterestIconField";

function setup(value?: string) {
    const onChange = vi.fn();
    render(<InterestIconField value={value} onChange={onChange} />);
    return onChange;
}

async function openPicker() {
    fireEvent.click(screen.getByTestId("interest-icon-trigger"));
    return screen.findByTestId("interest-icon-popover");
}

describe("InterestIconField", () => {
    beforeEach(() => {
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });
    afterEach(() => cleanup());

    it("shows 'No icon' when empty and the chosen icon when set, with Clear only when set", () => {
        setup();
        expect(screen.getByTestId("interest-icon-trigger")).toHaveTextContent("No icon");
        expect(screen.queryByTestId("interest-icon-clear")).toBeNull();
        cleanup();

        setup("lucide:guitar");
        expect(screen.getByTestId("interest-icon-trigger").querySelector('[data-testid="interest-icon-svg"]')).not.toBeNull();
        expect(screen.getByTestId("interest-icon-clear")).toBeInTheDocument();
        cleanup();

        setup("🎸");
        expect(screen.getByTestId("interest-icon-trigger")).toHaveTextContent("🎸");
    });

    it("treats an unusable stored value like no icon", () => {
        setup("lucide:does-not-exist");
        expect(screen.getByTestId("interest-icon-trigger")).toHaveTextContent("No icon");
        expect(screen.queryByTestId("interest-icon-clear")).toBeNull();
    });

    it("filters the catalog by search text and picks an icon", async () => {
        const onChange = setup();
        await openPicker();
        const allOptions = screen.getAllByRole("option").length;
        expect(allOptions).toBeGreaterThan(100);

        fireEvent.change(screen.getByTestId("interest-icon-search"), { target: { value: "guitar" } });

        const options = screen.getAllByRole("option");
        expect(options.length).toBeLessThan(allOptions);
        fireEvent.click(screen.getByTestId("interest-icon-option-guitar"));

        expect(onChange).toHaveBeenCalledWith("lucide:guitar");
        await waitFor(() => expect(screen.queryByTestId("interest-icon-popover")).toBeNull());
    });

    it("finds icons by hobby keyword, not just by name", async () => {
        setup();
        await openPicker();

        fireEvent.change(screen.getByTestId("interest-icon-search"), { target: { value: "football" } });

        expect(screen.getByTestId("interest-icon-option-goal")).toBeInTheDocument();
    });

    it("shows an empty state when nothing matches and still accepts an emoji", async () => {
        const onChange = setup();
        await openPicker();

        fireEvent.change(screen.getByTestId("interest-icon-search"), { target: { value: "zzzzzz" } });

        expect(screen.getByTestId("interest-icon-empty")).toHaveTextContent("No icons match");
        expect(screen.queryAllByRole("option")).toHaveLength(0);

        fireEvent.change(screen.getByTestId("interest-icon-emoji-input"), { target: { value: "🎻" } });
        expect(onChange).toHaveBeenCalledWith("🎻");
    });

    it("accepts a single emoji and rejects text or several emoji with an inline error", async () => {
        const onChange = setup();
        await openPicker();
        const input = screen.getByTestId("interest-icon-emoji-input");

        fireEvent.change(input, { target: { value: "guitar" } });
        expect(screen.getByTestId("interest-icon-emoji-error")).toHaveTextContent("Enter a single emoji");
        expect(onChange).not.toHaveBeenCalled();

        fireEvent.change(input, { target: { value: "🎸🎹" } });
        expect(screen.getByTestId("interest-icon-emoji-error")).toBeInTheDocument();
        expect(onChange).not.toHaveBeenCalled();

        fireEvent.change(input, { target: { value: "🎸" } });
        expect(onChange).toHaveBeenCalledWith("🎸");
    });

    it("clears the icon", () => {
        const onChange = setup("lucide:guitar");

        fireEvent.click(screen.getByTestId("interest-icon-clear"));

        expect(onChange).toHaveBeenCalledWith(undefined);
    });

    it("moves through the grid with the keyboard and closes on Escape returning focus to the button", async () => {
        setup();
        await openPicker();
        const search = screen.getByTestId("interest-icon-search");
        await waitFor(() => expect(search).toHaveFocus());

        fireEvent.keyDown(search, { key: "ArrowDown" });
        const options = screen.getAllByRole("option");
        expect(options[0]).toHaveFocus();

        fireEvent.keyDown(options[0], { key: "ArrowRight" });
        expect(options[1]).toHaveFocus();
        fireEvent.keyDown(options[1], { key: "ArrowLeft" });
        expect(options[0]).toHaveFocus();
        fireEvent.keyDown(options[0], { key: "End" });
        expect(options[options.length - 1]).toHaveFocus();

        fireEvent.keyDown(options[options.length - 1], { key: "Escape" });
        await waitFor(() => expect(screen.queryByTestId("interest-icon-popover")).toBeNull());
        expect(screen.getByTestId("interest-icon-trigger")).toHaveFocus();
    });

    it("uses translated labels", async () => {
        useI18nStore.setState({ locale: "de", _hydrated: true });
        setup();

        expect(screen.getByTestId("interest-icon-trigger")).toHaveTextContent("Kein Symbol");
        await openPicker();
        expect(screen.getByTestId("interest-icon-search")).toHaveAttribute("placeholder", "Suchen, z. B. Musik oder Wandern");
    });
});
