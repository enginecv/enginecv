import { act, cleanup, fireEvent, render, screen, waitFor, within, configure } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { useI18nStore } from "@/lib/i18n";
import { makeCv, makeLetter, resetLetterTables } from "../../../test/setup/letter-fixtures";
import { LettersTab } from "./LettersTab";

// Database-backed UI: give async queries room when the machine is busy.
configure({ asyncUtilTimeout: 4000 });

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/dashboard" }));

describe("LettersTab", () => {
    beforeEach(async () => {
        push.mockClear();
        await resetLetterTables();
        act(() => useI18nStore.setState({ locale: "en", _hydrated: true }));
    });
    afterEach(cleanup);

    it("tells the person a letter needs a CV and offers to create one", async () => {
        const onCreateCv = vi.fn();
        render(<LettersTab onCreateCv={onCreateCv} />);
        expect(await screen.findByTestId("letters-no-cvs")).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("letters-create-cv"));
        expect(onCreateCv).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId("letter-new")).toBeNull();
    });

    it("shows an empty state when there are CVs but no letters", async () => {
        await db.resumes.put(makeCv());
        render(<LettersTab onCreateCv={vi.fn()} />);
        expect(await screen.findByTestId("letters-empty")).toBeInTheDocument();
        expect(screen.getByTestId("letter-new")).toBeInTheDocument();
    });

    it("creates a letter for the only CV and opens it", async () => {
        const cv = makeCv();
        await db.resumes.put(cv);
        render(<LettersTab onCreateCv={vi.fn()} />);
        fireEvent.click(await screen.findByTestId("letter-new"));

        await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
        const [letter] = await db.coverLetters.toArray();
        expect(letter).toMatchObject({ cvId: cv.id, status: "draft" });
        expect(push).toHaveBeenCalledWith(`/letters/${letter.id}`);
    });

    it("asks which CV when there are several, and links the letter to the one chosen", async () => {
        await db.resumes.bulkPut([makeCv({ id: "cv-a", title: "Design CV" }), makeCv({ id: "cv-b", title: "Research CV" })]);
        render(<LettersTab onCreateCv={vi.fn()} />);
        fireEvent.click(await screen.findByTestId("letter-new"));

        const dialog = await screen.findByTestId("letters-cv-picker");
        fireEvent.change(within(dialog).getByTestId("letters-cv-select"), { target: { value: "cv-b" } });
        fireEvent.click(within(dialog).getByTestId("letters-cv-create"));

        await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
        expect((await db.coverLetters.toArray())[0].cvId).toBe("cv-b");
    });

    it("lists existing letters with their status and opens one on click", async () => {
        await db.resumes.put(makeCv());
        await db.coverLetters.bulkPut([
            makeLetter({ id: "l1", company: "Acme", role: "Designer", updatedAt: 5 }),
            makeLetter({ id: "l2", title: "Globex note", status: "snapshot", cvId: null, frozen: { at: 1, sender: { name: "A", headline: "", email: "", phone: "", address: "", website: "", signatureName: "A" }, design: {} as never, tokens: {}, photo: "", cvTitle: "" } as never, updatedAt: 9 }),
        ]);
        render(<LettersTab onCreateCv={vi.fn()} />);

        const cards = await screen.findAllByTestId("letter-card");
        expect(cards).toHaveLength(2);
        // Letters are grouped by CV; the one with no CV comes last.
        expect(cards[0]).toHaveTextContent("Acme - Designer");
        expect(cards[1]).toHaveTextContent("Globex note");
        expect(within(cards[1]).getByTestId("letter-status")).toHaveTextContent("Frozen");

        fireEvent.click(within(cards[0]).getByRole("button", { name: /^Open / }));
        expect(push).toHaveBeenCalledWith("/letters/l1");
    });

    it("keeps the picker open and says so when the letter cannot be created, instead of quietly showing no letters", async () => {
        await db.resumes.bulkPut([makeCv({ id: "cv-a", title: "Design CV" }), makeCv({ id: "cv-b", title: "Research CV" })]);
        const spy = vi.spyOn(db.coverLetters, "put").mockRejectedValueOnce(new Error("storage is full"));
        const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
        render(<LettersTab onCreateCv={vi.fn()} />);
        fireEvent.click(await screen.findByTestId("letter-new"));
        fireEvent.click(within(await screen.findByTestId("letters-cv-picker")).getByTestId("letters-cv-create"));

        expect(await screen.findByTestId("letters-cv-picker-error")).toBeInTheDocument();
        expect(screen.getByTestId("letters-cv-picker")).toBeInTheDocument(); // still there, to try again
        expect(push).not.toHaveBeenCalled();
        expect(await db.coverLetters.count()).toBe(0);

        // Trying again works once the problem is gone.
        spy.mockRestore();
        fireEvent.click(screen.getByTestId("letters-cv-create"));
        await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
        errors.mockRestore();
    });

    it("creates a letter for a CV that fails the strict schema but opens in the editor", async () => {
        const cv = JSON.parse(JSON.stringify(makeCv({ id: "odd", name: "Master Person" })));
        cv.basics.email = "not-an-email";
        await db.resumes.put(cv);
        render(<LettersTab onCreateCv={vi.fn()} />);
        fireEvent.click(await screen.findByTestId("letter-new"));
        await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
        expect((await db.coverLetters.toArray())[0]).toMatchObject({ cvId: "odd", status: "draft" });
    });

    it("shows a loading state before the data arrives", () => {
        render(<LettersTab onCreateCv={vi.fn()} />);
        expect(screen.getByTestId("letters-loading")).toBeInTheDocument();
    });
});
