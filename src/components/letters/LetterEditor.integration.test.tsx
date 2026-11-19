import { act, cleanup, fireEvent, render, screen, waitFor, within, configure } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { useI18nStore } from "@/lib/i18n";
import { createLetterRecord, getLetter } from "@/lib/letters/store";
import { makeCv, resetLetterTables } from "../../../test/setup/letter-fixtures";
import { LetterEditor } from "./LetterEditor";

// Database-backed UI: give async queries room when the machine is busy.
configure({ asyncUtilTimeout: 4000 });

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/letters/x" }));

async function openEditor() {
    const cv = makeCv();
    await db.resumes.put(cv);
    const letter = await createLetterRecord(cv.id!, { company: "Acme", role: "Designer" });
    render(<LetterEditor letterId={letter.id} />);
    await screen.findByTestId("letter-editor");
    // The sender pane and the pages appear once the CV has been read.
    await screen.findByTestId("letter-sender-pane");
    await screen.findAllByTestId("letter-page");
    return { cv, letter };
}

/** The first printed page (the preview also holds an off-screen copy used for measuring). */
const preview = () => screen.getAllByTestId("letter-page")[0];
const firstParagraph = async () => (await screen.findByTestId("letter-paragraph-input-0")) as HTMLTextAreaElement;

describe("LetterEditor", () => {
    beforeEach(async () => {
        await resetLetterTables();
        act(() => useI18nStore.setState({ locale: "en", _hydrated: true }));
    });
    afterEach(cleanup);

    it("shows a not-found state for a letter that does not exist", async () => {
        render(<LetterEditor letterId="nope" />);
        expect(await screen.findByTestId("letter-editor-missing")).toBeInTheDocument();
    });

    it("fills the sender block from the CV and shows the letter on a page", async () => {
        await openEditor();
        await waitFor(() => expect(within(preview()).getAllByText("Amina Hodzic").length).toBeGreaterThan(0));
        expect(within(preview()).getByText(/amina@example.com/)).toBeInTheDocument();
        expect(screen.getByTestId("letter-sender-email")).toHaveValue("amina@example.com");
    });

    it("follows the CV without touching the text being typed", async () => {
        const { cv } = await openEditor();
        const input = await firstParagraph();
        fireEvent.change(input, { target: { value: "Typed before the CV changed" } });
        await waitFor(() => expect(input).toHaveValue("Typed before the CV changed"));

        await act(async () => {
            await db.resumes.put({ ...cv, basics: { ...cv.basics, phone: "+49 99 888" }, settings: { ...cv.settings, colors: { ...cv.settings.colors, accent: "#112233" } } });
        });

        await waitFor(() => expect(within(preview()).getByText(/\+49 99 888/)).toBeInTheDocument());
        expect(preview().innerHTML).toContain("rgb(17, 34, 51)");
        // Same textarea, same text: the CV change replaced only derived output.
        expect(await firstParagraph()).toBe(input);
        expect(input).toHaveValue("Typed before the CV changed");
    });

    it("overrides one sender field, marks it, keeps it when the CV changes, and resets it", async () => {
        const { cv } = await openEditor();
        const email = screen.getByTestId("letter-sender-email");
        fireEvent.change(email, { target: { value: "work@acme.test" } });

        expect(await screen.findByTestId("letter-sender-differs-email")).toBeInTheDocument();
        expect(screen.queryByTestId("letter-sender-differs-phone")).toBeNull();
        expect(within(preview()).getByText(/work@acme.test/)).toBeInTheDocument();

        await act(async () => {
            await db.resumes.put({ ...cv, basics: { ...cv.basics, email: "new@example.com" } });
        });
        await waitFor(() => expect(screen.getByTestId("letter-sender-reset-email")).toBeInTheDocument());
        expect(within(preview()).getByText(/work@acme.test/)).toBeInTheDocument();

        fireEvent.click(screen.getByTestId("letter-sender-reset-email"));
        await waitFor(() => expect(within(preview()).getByText(/new@example.com/)).toBeInTheDocument());
        expect(screen.queryByTestId("letter-sender-differs-email")).toBeNull();
    });

    it("never writes an override to the CV", async () => {
        const { cv } = await openEditor();
        fireEvent.change(screen.getByTestId("letter-sender-name"), { target: { value: "A. Hodzic" } });
        await waitFor(() => expect(screen.getByTestId("letter-sender-differs-name")).toBeInTheDocument());
        expect((await db.resumes.get(cv.id!))?.basics.name).toBe("Amina Hodzic");
    });

    it("autosaves edits to the letter", async () => {
        const { letter } = await openEditor();
        fireEvent.change(await firstParagraph(), { target: { value: "Saved text" } });
        await waitFor(async () => expect((await getLetter(letter.id))?.paragraphs[0].markdown).toBe("Saved text"), { timeout: 3000 });
        expect(screen.getByTestId("letter-save-state")).toHaveTextContent(/Saved/);
    });

    it("inserts a token at the caret and shows its value as a chip", async () => {
        await openEditor();
        const input = await firstParagraph();
        fireEvent.change(input, { target: { value: "I am a  here" } });
        input.setSelectionRange(7, 7);
        fireEvent.focus(input);
        fireEvent.click(screen.getByTestId("letter-token-role"));
        await waitFor(() => expect(input).toHaveValue("I am a {{role}} here"));
        await waitFor(() => expect(preview().querySelector('[data-letter-chip="resolved"]')).toHaveTextContent("Senior Product Designer"));
    });

    it("keeps pending text and offers a choice when another tab saved the letter", async () => {
        const { letter } = await openEditor();
        // Edit first so this tab has unsaved text, then let "another tab" save the letter.
        fireEvent.change(await firstParagraph(), { target: { value: "My unsaved words" } });
        await act(async () => {
            await db.coverLetters.put({ ...letter, company: "Saved elsewhere", updatedAt: letter.updatedAt + 10_000 });
        });

        expect(await screen.findByTestId("letter-conflict", {}, { timeout: 3000 })).toBeInTheDocument();
        expect((await getLetter(letter.id))?.company).toBe("Saved elsewhere");
        expect((await getLetter(letter.id))?.paragraphs[0].markdown).not.toBe("My unsaved words");

        fireEvent.click(screen.getByTestId("letter-conflict-keep"));
        await waitFor(async () => expect((await getLetter(letter.id))?.paragraphs[0].markdown).toBe("My unsaved words"));
        expect(screen.queryByTestId("letter-conflict")).toBeNull();
    });

    it("reduces formatted pastes to plain text", async () => {
        await openEditor();
        const input = await firstParagraph();
        fireEvent.paste(input, { clipboardData: { types: ["text/html", "text/plain"], getData: (type: string) => (type === "text/plain" ? "plain words" : "<b style='font-size:30px'>styled</b>") } });
        await waitFor(() => expect(input).toHaveValue("plain words"));
    });
});
