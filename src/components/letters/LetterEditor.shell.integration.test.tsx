import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { useI18nStore } from "@/lib/i18n";
import { createLetterRecord, getLetter } from "@/lib/letters/store";
import { makeCv, resetLetterTables } from "../../../test/setup/letter-fixtures";
import { LetterEditor } from "./LetterEditor";

// Database-backed UI: give async queries room when the machine is busy.
configure({ asyncUtilTimeout: 4000 });

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/letters/x" }));

async function openEditor(width = 1280) {
    Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
    const cv = makeCv();
    await db.resumes.put(cv);
    const letter = await createLetterRecord(cv.id!, { company: "Acme" });
    render(<LetterEditor letterId={letter.id} />);
    await screen.findByTestId("letter-form");
    // On a phone the preview is only mounted once its pane is shown.
    if (width >= 1024) await screen.findAllByTestId("letter-page");
    return letter;
}

describe("the letter editor uses the CV editor's shell", () => {
    beforeEach(async () => {
        await resetLetterTables();
        act(() => useI18nStore.setState({ locale: "en", _hydrated: true }));
    });
    afterEach(() => {
        cleanup();
        Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true });
    });

    describe("the paragraphs are a list of any length", () => {
        it("starts with one empty paragraph, not a fixed set, and offers the usual structure only as optional tips", async () => {
            await openEditor();
            expect(screen.getAllByTestId(/^letter-paragraph-card-\d+$/)).toHaveLength(1);
            const tips = screen.getByTestId("letter-tips");
            expect(tips).toHaveTextContent(/advice, not a rule/i);
            expect(tips.querySelectorAll("li")).toHaveLength(4);
        });

        it("adds as many paragraphs as needed, removes them, and can have none", async () => {
            const letter = await openEditor();
            for (let count = 0; count < 5; count++) fireEvent.click(screen.getByTestId("letter-paragraph-add"));
            await waitFor(() => expect(screen.getAllByTestId(/^letter-paragraph-card-\d+$/)).toHaveLength(6));

            fireEvent.click(screen.getByTestId("letter-paragraph-remove-5"));
            fireEvent.click(screen.getByTestId("letter-paragraph-remove-4"));
            await waitFor(() => expect(screen.getAllByTestId(/^letter-paragraph-card-\d+$/)).toHaveLength(4));

            for (let index = 3; index >= 0; index--) fireEvent.click(screen.getByTestId(`letter-paragraph-remove-${index}`));
            expect(await screen.findByTestId("letter-paragraphs-empty")).toBeInTheDocument();
            await waitFor(async () => expect((await getLetter(letter.id))?.paragraphs).toEqual([]), { timeout: 4000 });
        });

        it("reorders with the arrows, and each card has the CV editor's drag grip", async () => {
            const letter = await openEditor();
            fireEvent.click(screen.getByTestId("letter-paragraph-add"));
            const first = (await screen.findByTestId("letter-paragraph-input-0")) as HTMLTextAreaElement;
            fireEvent.change(first, { target: { value: "First" } });
            const second = (await screen.findByTestId("letter-paragraph-input-1")) as HTMLTextAreaElement;
            fireEvent.change(second, { target: { value: "Second" } });
            await waitFor(() => expect(second).toHaveValue("Second"));

            expect(screen.getByTestId("letter-paragraph-drag-0")).toHaveAttribute("aria-label", "Drag from here");
            expect(screen.getByTestId("letter-paragraph-up-0")).toBeDisabled();
            fireEvent.click(screen.getByTestId("letter-paragraph-down-0"));
            await waitFor(async () => expect((await getLetter(letter.id))?.paragraphs.map((paragraph) => paragraph.markdown)).toEqual(["Second", "First"]), { timeout: 4000 });
            expect(screen.getByTestId("letter-paragraph-input-0")).toHaveValue("Second");
        });

        it("keeps the list read-only for a sent letter: no grips, no buttons, no editing", async () => {
            const letter = await openEditor();
            fireEvent.change(await screen.findByTestId("letter-paragraph-input-0"), { target: { value: "Final words" } });
            await waitFor(async () => expect((await getLetter(letter.id))?.paragraphs[0].markdown).toBe("Final words"), { timeout: 4000 });
            fireEvent.click(screen.getByTestId("letter-mark-sent"));
            fireEvent.click(within(await screen.findByTestId("letter-send-dialog")).getByTestId("letter-send-confirm"));
            expect(await screen.findByTestId("letter-paragraph-text-0")).toHaveTextContent("Final words");
            expect(screen.queryByTestId("letter-paragraph-drag-0")).toBeNull();
            expect(screen.queryByTestId("letter-paragraph-add")).toBeNull();
        });
    });

    describe("the layout", () => {
        it("is a resizable split on a desktop: two panels with a draggable separator between them", async () => {
            await openEditor(1280);
            expect(screen.getByRole("separator")).toBeInTheDocument();
            expect(document.querySelectorAll("[data-panel]").length).toBe(2);
            expect(screen.getByTestId("letter-form")).toBeInTheDocument();
            expect(screen.getByTestId("letter-preview")).toBeInTheDocument(); // both panes at once
            expect(screen.queryByTestId("letter-pane-edit")).toBeNull();
        });

        it("shows one pane at a time with the CV editor's footer to switch on a phone", async () => {
            await openEditor(800);
            expect(screen.queryByRole("separator")).toBeNull();
            expect(screen.getByTestId("letter-form")).toBeInTheDocument();
            expect(screen.queryByTestId("letter-preview")).toBeNull();

            fireEvent.click(screen.getByTestId("letter-pane-preview"));
            expect(await screen.findByTestId("letter-preview")).toBeInTheDocument();
            expect(screen.queryByTestId("letter-form")).toBeNull();
            expect(screen.getByTestId("letter-pane-preview")).toHaveAttribute("aria-pressed", "true");

            fireEvent.click(screen.getByTestId("letter-pane-edit"));
            expect(await screen.findByTestId("letter-form")).toBeInTheDocument();
        });
    });

    describe("the header", () => {
        it("has the CV editor's header: back link, inline title, save status, theme, language and the export button", async () => {
            await openEditor();
            expect(screen.getByRole("link", { name: "Back to letters" })).toHaveAttribute("href", "/dashboard?tab=letters");
            expect(screen.getByTestId("letter-title")).toBeInTheDocument();
            expect(screen.getByRole("button", { name: /theme/i })).toBeInTheDocument();
            expect(screen.getByRole("button", { name: /language/i })).toBeInTheDocument();
            expect(screen.getByTestId("export-menu-button")).toHaveTextContent("Export");
        });

        it("shows the CV editor's save status after a change", async () => {
            await openEditor();
            fireEvent.change(screen.getByTestId("letter-title"), { target: { value: "Dream job" } });
            await waitFor(() => expect(screen.getByTestId("letter-save-state")).toHaveTextContent(/Saved at/), { timeout: 4000 });
        });
    });
});
