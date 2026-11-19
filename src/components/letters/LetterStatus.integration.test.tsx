import { act, cleanup, fireEvent, render, screen, waitFor, within, configure } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { useI18nStore } from "@/lib/i18n";
import { LetterOperationError, createLetterRecord, getLetter, markSent, unfreeze } from "@/lib/letters/store";
import { makeCv, makeLetter, resetLetterTables } from "../../../test/setup/letter-fixtures";
import { LetterEditor } from "./LetterEditor";

// Database-backed UI: give async queries room when the machine is busy.
configure({ asyncUtilTimeout: 4000 });

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/letters/x" }));

async function openEditor(cvOverrides: Parameters<typeof makeCv>[0] = {}) {
    const cv = makeCv(cvOverrides);
    await db.resumes.put(cv);
    const letter = await createLetterRecord(cv.id!, { company: "Acme", role: "Designer" });
    render(<LetterEditor letterId={letter.id} />);
    await screen.findByTestId("letter-sender-pane");
    await screen.findAllByTestId("letter-page");
    return { cv, letter };
}

const page = () => screen.getAllByTestId("letter-page")[0];

describe("sending, freezing and unfreezing", () => {
    beforeEach(async () => {
        push.mockClear();
        await resetLetterTables();
        act(() => useI18nStore.setState({ locale: "en", _hydrated: true }));
    });
    afterEach(cleanup);

    it("warns about what looks wrong before freezing, and asks first", async () => {
        const { letter } = await openEditor({ email: "" });
        fireEvent.click(screen.getByTestId("letter-mark-sent"));
        const dialog = await screen.findByTestId("letter-send-dialog");
        expect(within(dialog).getByTestId("letter-send-warnings")).toHaveTextContent(/Email is empty/);
        expect(within(dialog).getByTestId("letter-send-confirm")).toHaveTextContent("Mark as sent anyway");
        expect((await getLetter(letter.id))?.status).toBe("draft"); // nothing happened yet
    });

    it("freezes on confirm: marked as sent, the text is locked, and it ignores later CV changes", async () => {
        const { cv, letter } = await openEditor();
        fireEvent.click(screen.getByTestId("letter-mark-sent"));
        fireEvent.click(within(await screen.findByTestId("letter-send-dialog")).getByTestId("letter-send-confirm"));

        await waitFor(async () => expect((await getLetter(letter.id))?.status).toBe("sent"), { timeout: 4000 });
        await waitFor(() => expect(screen.getByTestId("letter-status-chip")).toHaveTextContent("Sent"));
        expect(screen.queryByTestId("letter-paragraph-input-0")).toBeNull(); // read-only
        expect(screen.getByTestId("letter-paragraph-text-0")).toBeInTheDocument();

        await act(async () => {
            await db.resumes.put({ ...cv, basics: { ...cv.basics, name: "Changed Name", phone: "000" }, settings: { ...cv.settings, colors: { ...cv.settings.colors, accent: "#00ff00" } } });
        });
        await act(async () => {
            await db.resumes.delete(cv.id!);
        });
        // Still the sender and look it had when sent, even with the CV gone.
        expect(within(page()).getAllByText("Amina Hodzic").length).toBeGreaterThan(0);
        expect(page().textContent).not.toContain("Changed Name");
        expect(page().innerHTML).not.toContain("rgb(0, 255, 0)");
        expect(screen.queryByText(/no longer exists/)).toBeNull();
    });

    it("saves the text being typed before freezing, so it is part of what was sent", async () => {
        const { letter } = await openEditor();
        fireEvent.change(await screen.findByTestId("letter-paragraph-input-0"), { target: { value: "Words typed a moment ago" } });
        fireEvent.click(screen.getByTestId("letter-mark-sent"));
        fireEvent.click(within(await screen.findByTestId("letter-send-dialog")).getByTestId("letter-send-confirm"));

        await waitFor(async () => expect((await getLetter(letter.id))?.status).toBe("sent"), { timeout: 4000 });
        expect((await getLetter(letter.id))?.paragraphs[0].markdown).toBe("Words typed a moment ago");
    });

    it("unfreezes after confirmation: it follows the CV again and can be edited", async () => {
        const { cv, letter } = await openEditor();
        await markSent(letter.id);
        await screen.findByTestId("letter-unfreeze", {}, { timeout: 4000 });

        fireEvent.click(screen.getByTestId("letter-unfreeze"));
        expect((await getLetter(letter.id))?.status).toBe("sent"); // it asks first
        fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Unfreeze" }));

        await waitFor(async () => expect((await getLetter(letter.id))?.status).toBe("draft"), { timeout: 4000 });
        await act(async () => {
            await db.resumes.put({ ...cv, basics: { ...cv.basics, phone: "+49 77 777" } });
        });
        await waitFor(() => expect(within(page()).getByText(/\+49 77 777/)).toBeInTheDocument());
        expect(await screen.findByTestId("letter-paragraph-input-0")).toBeInTheDocument();
    });

    it("duplicates a sent letter as a new live draft and leaves the sent one alone", async () => {
        const { letter } = await openEditor();
        await markSent(letter.id);
        const button = await screen.findByTestId("letter-duplicate-draft", {}, { timeout: 4000 });
        fireEvent.click(button);

        await waitFor(() => expect(push).toHaveBeenCalledTimes(1), { timeout: 4000 });
        const copyId = (push.mock.calls[0][0] as string).replace("/letters/", "");
        expect(copyId).not.toBe(letter.id);
        expect(await getLetter(copyId)).toMatchObject({ status: "draft", frozen: null });
        expect((await getLetter(letter.id))?.status).toBe("sent");
    });
});

describe("markSent and unfreeze in the store", () => {
    beforeEach(async () => {
        await resetLetterTables();
    });

    it("refuses what cannot work: no such letter, already sent, no CV, not frozen", async () => {
        await db.resumes.put(makeCv());
        await db.coverLetters.put(makeLetter({ id: "d" }));
        await expect(markSent("nope")).rejects.toMatchObject({ code: "not-found" });
        await markSent("d");
        await expect(markSent("d")).rejects.toMatchObject({ code: "not-draft" });

        await db.coverLetters.put(makeLetter({ id: "orphan", cvId: "gone" }));
        await expect(markSent("orphan")).rejects.toBeInstanceOf(LetterOperationError);
        await expect(markSent("orphan")).rejects.toMatchObject({ code: "cv-missing" });

        await db.coverLetters.put(makeLetter({ id: "plain" }));
        await expect(unfreeze("plain")).rejects.toMatchObject({ code: "not-frozen" });
    });

    it("can unfreeze onto a different CV", async () => {
        await db.resumes.bulkPut([makeCv({ id: "cv-1" }), makeCv({ id: "cv-2", name: "Other" })]);
        await db.coverLetters.put(makeLetter({ id: "d" }));
        await markSent("d");
        const draft = await unfreeze("d", "cv-2");
        expect(draft).toMatchObject({ status: "draft", cvId: "cv-2", frozen: null });
        expect(draft.lastResolved?.sender.name).toBe("Other");
    });
});

describe("a draft whose CV was deleted", () => {
    beforeEach(async () => {
        push.mockClear();
        await resetLetterTables();
        act(() => useI18nStore.setState({ locale: "en", _hydrated: true }));
    });
    afterEach(cleanup);

    it("stays open and readable with a banner, and can be kept as a frozen snapshot", async () => {
        const { cv, letter } = await openEditor({ name: "Last Seen Name" });
        await act(async () => {
            await db.resumes.delete(cv.id!);
        });
        const banner = await screen.findByTestId("letter-cv-missing");
        expect(within(page()).getAllByText("Last Seen Name").length).toBeGreaterThan(0); // from the cache

        fireEvent.click(within(banner).getByTestId("letter-cv-missing-snapshot"));
        await waitFor(async () => expect((await getLetter(letter.id))?.status).toBe("snapshot"), { timeout: 4000 });
        await waitFor(() => expect(screen.queryByTestId("letter-cv-missing")).toBeNull());
        expect(within(page()).getAllByText("Last Seen Name").length).toBeGreaterThan(0);
    });

    it("can be linked to another CV, and then follows that one", async () => {
        const { cv, letter } = await openEditor();
        await db.resumes.put(makeCv({ id: "cv-2", title: "Second", name: "Second Person" }));
        await act(async () => {
            await db.resumes.delete(cv.id!);
        });
        fireEvent.click(await screen.findByTestId("letter-cv-missing-link"));
        const dialog = await screen.findByTestId("letter-repoint-dialog");
        fireEvent.click(within(dialog).getByTestId("letter-repoint-confirm"));

        await waitFor(async () => expect((await getLetter(letter.id))?.cvId).toBe("cv-2"), { timeout: 4000 });
        await waitFor(() => expect(within(page()).getAllByText("Second Person").length).toBeGreaterThan(0));
        expect(screen.queryByTestId("letter-cv-missing")).toBeNull();
    });
});
