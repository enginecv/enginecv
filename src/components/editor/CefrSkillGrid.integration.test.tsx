import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyCefrSkillLevels, type CefrSkillLevels } from "@/lib/cefr";
import { useI18nStore } from "@/lib/i18n";
import { CefrSkillGrid } from "./CefrSkillGrid";

function Harness({ initial, onChange }: { initial: CefrSkillLevels; onChange?: (next: CefrSkillLevels) => void }) {
    const [value, setValue] = useState(initial);
    return (
        <CefrSkillGrid
            value={value}
            onChange={(next) => {
                setValue(next);
                onChange?.(next);
            }}
        />
    );
}

describe("CefrSkillGrid", () => {
    beforeEach(() => {
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    afterEach(() => {
        cleanup();
        act(() => useI18nStore.setState({ locale: "en" }));
    });

    it("groups the five skills and explains unrated ones", () => {
        render(<Harness initial={emptyCefrSkillLevels()} />);

        expect(screen.getByRole("heading", { name: "Understanding" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Speaking" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Writing" })).toBeInTheDocument();
        expect(screen.getAllByRole("radiogroup")).toHaveLength(5);
        expect(screen.getByTestId("cefr-descriptor-reading")).toHaveTextContent("Not rated");
        expect(screen.getByTestId("cefr-overall-level")).toHaveTextContent("—");
    });

    it("picks, describes and clears a level", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Harness initial={emptyCefrSkillLevels()} onChange={onChange} />);

        await user.click(screen.getByTestId("cefr-level-listening-C1"));
        expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ listening: "C1" }));
        expect(screen.getByTestId("cefr-level-listening-C1")).toHaveAttribute("aria-checked", "true");
        expect(screen.getByTestId("cefr-descriptor-listening")).toHaveTextContent("C1 · Proficient user");
        expect(screen.getByTestId("cefr-overall-level")).toHaveTextContent("C1");

        await user.click(screen.getByTestId("cefr-level-listening-C1"));
        expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ listening: "" }));
        // The pointer still rests on C1, which keeps previewing it until it leaves.
        await user.unhover(screen.getByTestId("cefr-scale-listening"));
        expect(screen.getByTestId("cefr-descriptor-listening")).toHaveTextContent("Not rated");
    });

    it("previews another level's description on hover without changing the value", () => {
        const onChange = vi.fn();
        render(<Harness initial={{ ...emptyCefrSkillLevels(), writing: "B1" }} onChange={onChange} />);

        fireEvent.mouseEnter(screen.getByTestId("cefr-level-writing-C2"));
        expect(screen.getByTestId("cefr-descriptor-writing")).toHaveTextContent("C2 · Proficient user");
        fireEvent.mouseLeave(screen.getByTestId("cefr-scale-writing"));
        expect(screen.getByTestId("cefr-descriptor-writing")).toHaveTextContent("B1 · Independent user");
        expect(onChange).not.toHaveBeenCalled();
    });

    it("moves the level with arrow keys", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Harness initial={{ ...emptyCefrSkillLevels(), reading: "B1" }} onChange={onChange} />);

        screen.getByTestId("cefr-level-reading-B1").focus();
        await user.keyboard("{ArrowRight}");
        expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ reading: "B2" }));
        expect(screen.getByTestId("cefr-level-reading-B2")).toHaveFocus();
    });

    it("copies the last picked level to every skill", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Harness initial={emptyCefrSkillLevels()} onChange={onChange} />);

        await user.click(screen.getByTestId("cefr-level-spokenInteraction-B2"));
        await user.click(screen.getByTestId("cefr-fill-all"));
        expect(onChange).toHaveBeenLastCalledWith({
            listening: "B2", reading: "B2", spokenInteraction: "B2", spokenProduction: "B2", writing: "B2",
        });
        expect(screen.queryByTestId("cefr-fill-all")).not.toBeInTheDocument();
    });

    it("renders descriptions in Bosnian", () => {
        act(() => useI18nStore.setState({ locale: "bs", _hydrated: true }));
        render(<Harness initial={{ ...emptyCefrSkillLevels(), listening: "A1" }} />);
        expect(screen.getByRole("heading", { name: "Razumijevanje" })).toBeInTheDocument();
        expect(screen.getByTestId("cefr-descriptor-listening")).toHaveTextContent("Osnovni korisnik");
    });
});
