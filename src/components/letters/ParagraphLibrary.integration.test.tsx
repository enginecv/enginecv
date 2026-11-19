import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { useI18nStore } from "@/lib/i18n";
import { createLetterRecord, getLetter, saveLetter, saveParagraph } from "@/lib/letters/store";
import { makeCv, resetLetterTables } from "../../../test/setup/letter-fixtures";
import { LetterEditor } from "./LetterEditor";
import { ParagraphLibrary } from "./ParagraphLibrary";

// Database-backed UI: give async queries room when the machine is busy.
configure({ asyncUtilTimeout: 4000 });

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/letters/x" }));

describe("ParagraphLibrary on its own", () => {
    beforeEach(async () => {
        await resetLetterTables();
        act(() => useI18nStore.setState({ locale: "en", _hydrated: true }));
    });
    afterEach(cleanup);

    it("shows an empty state, then the saved paragraphs", async () => {
        render(<ParagraphLibrary onInsert={vi.fn()} />);
        expect(await screen.findByTestId("letter-library-empty")).toBeInTheDocument();

        await act(async () => {
            await saveParagraph({ name: "Availability", markdown: "I can start in March." });
        });
        expect(await screen.findByTestId("letter-library-entry-name")).toHaveTextContent("Availability");
        expect(screen.queryByTestId("letter-library-empty")).toBeNull();
    });

    it("inserts the text, and renames and edits an entry without touching what was inserted", async () => {
        const onInsert = vi.fn();
        const entry = await saveParagraph({ name: "Closing", markdown: "Thank you for your time." });
        render(<ParagraphLibrary onInsert={onInsert} />);

        fireEvent.click(await screen.findByTestId("letter-library-insert"));
        expect(onInsert).toHaveBeenCalledWith("Thank you for your time.");

        fireEvent.click(screen.getByTestId("letter-library-edit"));
        fireEvent.change(screen.getByTestId("letter-library-edit-name"), { target: { value: "Thanks" } });
        fireEvent.change(screen.getByTestId("letter-library-edit-text"), { target: { value: "Many thanks." } });
        fireEvent.click(screen.getByTestId("letter-library-edit-save"));
        await waitFor(async () => expect((await db.letterParagraphs.get(entry.id))?.name).toBe("Thanks"));
        expect((await db.letterParagraphs.get(entry.id))?.markdown).toBe("Many thanks.");
        expect(onInsert).toHaveBeenCalledTimes(1);
    });

    it("asks before deleting, and says letters that used it are unchanged", async () => {
        const entry = await saveParagraph({ name: "Closing", markdown: "Thank you." });
        render(<ParagraphLibrary onInsert={vi.fn()} />);
        fireEvent.click(await screen.findByTestId("letter-library-delete"));

        const dialog = await screen.findByRole("dialog");
        expect(dialog).toHaveTextContent(/already use it are not changed/);
        expect(await db.letterParagraphs.get(entry.id)).toBeDefined();
        fireEvent.click(within(dialog).getByRole("button", { name: "Delete paragraph" }));
        await waitFor(async () => expect(await db.letterParagraphs.get(entry.id)).toBeUndefined());
    });

    it("cannot insert into a locked letter", async () => {
        await saveParagraph({ name: "Closing", markdown: "Thank you." });
        render(<ParagraphLibrary onInsert={vi.fn()} readOnly />);
        expect(await screen.findByTestId("letter-library-insert")).toBeDisabled();
    });
});

describe("saving and inserting through the letter editor", () => {
    beforeEach(async () => {
        await resetLetterTables();
        act(() => useI18nStore.setState({ locale: "en", _hydrated: true }));
    });
    afterEach(cleanup);

    async function openEditor() {
        const cv = makeCv();
        await db.resumes.put(cv);
        const letter = await createLetterRecord(cv.id!, { company: "Acme" });
        render(<LetterEditor letterId={letter.id} />);
        await screen.findByTestId("letter-sender-pane");
        return letter;
    }

    it("saves a paragraph to the library, inserts it into the letter as an editable copy, and leaves the entry alone when the copy is edited", async () => {
        const letter = await openEditor();
        const first = (await screen.findByTestId("letter-paragraph-input-0")) as HTMLTextAreaElement;
        fireEvent.change(first, { target: { value: "I am happy to relocate." } });
        await waitFor(() => expect(first).toHaveValue("I am happy to relocate."));

        fireEvent.click(screen.getByTestId("letter-paragraph-save-0"));
        fireEvent.change(await screen.findByTestId("letter-paragraph-save-name"), { target: { value: "Relocation" } });
        fireEvent.click(screen.getByTestId("letter-paragraph-save-confirm"));
        expect(await screen.findByTestId("letter-paragraph-saved")).toBeInTheDocument();
        await waitFor(async () => expect((await db.letterParagraphs.toArray())[0]).toMatchObject({ name: "Relocation", markdown: "I am happy to relocate." }));

        // Insert it: it is added after the existing paragraph (a new letter starts with one).
        fireEvent.click(await screen.findByTestId("letter-library-insert"));
        const copy = (await screen.findByTestId("letter-paragraph-input-1")) as HTMLTextAreaElement;
        expect(copy).toHaveValue("I am happy to relocate.");

        fireEvent.change(copy, { target: { value: "Edited only in the letter." } });
        await waitFor(async () => expect((await getLetter(letter.id))?.paragraphs[1]?.markdown).toBe("Edited only in the letter."), { timeout: 4000 });
        expect((await db.letterParagraphs.toArray())[0].markdown).toBe("I am happy to relocate.");
    });

    it("will not save an empty paragraph", async () => {
        await openEditor();
        expect(await screen.findByTestId("letter-paragraph-save-0")).toBeDisabled();
    });

    it("keeps the library when a letter is saved or deleted elsewhere", async () => {
        const letter = await openEditor();
        await saveParagraph({ name: "Keep me", markdown: "Library text." });
        await act(async () => {
            await saveLetter({ ...letter, company: "Elsewhere" }, letter.updatedAt);
        });
        expect(await screen.findByTestId("letter-library-entry-name")).toHaveTextContent("Keep me");
    });
});
