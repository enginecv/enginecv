import { act, cleanup, fireEvent, render, screen, waitFor, within, configure } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { useI18nStore } from "@/lib/i18n";
import { makeCv, makeLetter, makeSentLetter, resetLetterTables } from "../../../test/setup/letter-fixtures";
import { LettersTab } from "./LettersTab";

// Database-backed UI: give async queries room when the machine is busy.
configure({ asyncUtilTimeout: 4000 });

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/dashboard" }));

async function seed() {
    await db.resumes.bulkPut([makeCv({ id: "cv-a", title: "Design CV" }), makeCv({ id: "cv-b", title: "Research CV", name: "Second" })]);
    await db.coverLetters.bulkPut([
        makeLetter({ id: "a1", cvId: "cv-a", company: "Acme", role: "Designer", updatedAt: 3 }),
        makeLetter({ id: "a2", cvId: "cv-a", company: "Globex", role: "Lead", updatedAt: 5 }),
        makeLetter({ id: "a3", cvId: "cv-a", company: "Initech", role: "IC", updatedAt: 1 }),
        makeLetter({ id: "b1", cvId: "cv-b", company: "Umbrella", role: "Researcher", updatedAt: 2, senderOverrides: { email: "work@umbrella.test" } }),
    ]);
}

const card = (id: string) => document.querySelector<HTMLElement>(`[data-letter-id="${id}"]`)!;

describe("LettersTab groups and actions", () => {
    beforeEach(async () => {
        push.mockClear();
        await resetLetterTables();
        act(() => useI18nStore.setState({ locale: "en", _hydrated: true }));
    });
    afterEach(cleanup);

    it("groups letters under their CV with a count, newest first", async () => {
        await seed();
        render(<LettersTab onCreateCv={vi.fn()} />);
        const design = await screen.findByTestId("letters-group-cv-a");
        const research = screen.getByTestId("letters-group-cv-b");

        expect(within(design).getByRole("heading", { name: /Design CV/ })).toBeInTheDocument();
        expect(within(design).getByTestId("letters-group-count")).toHaveTextContent("3");
        expect(within(research).getByTestId("letters-group-count")).toHaveTextContent("1");
        expect(within(design).getAllByTestId("letter-card").map((element) => element.getAttribute("data-letter-id"))).toEqual(["a2", "a1", "a3"]);
    });

    it("limits the list to one CV when opened from that CV's card, and can show all again", async () => {
        await seed();
        const onClear = vi.fn();
        const { rerender } = render(<LettersTab onCreateCv={vi.fn()} cvFilter="cv-b" onClearCvFilter={onClear} />);
        await screen.findByTestId("letters-group-cv-b");
        expect(screen.queryByTestId("letters-group-cv-a")).toBeNull();
        expect(screen.getByTestId("letters-filter")).toHaveTextContent("Research CV");
        fireEvent.click(screen.getByTestId("letters-filter-clear"));
        expect(onClear).toHaveBeenCalled();
        rerender(<LettersTab onCreateCv={vi.fn()} cvFilter={null} onClearCvFilter={onClear} />);
        expect(await screen.findByTestId("letters-group-cv-a")).toBeInTheDocument();
        expect(screen.queryByTestId("letters-filter")).toBeNull();
    });

    it("shows a preview of the CV in each group header that opens the CV", async () => {
        await seed();
        render(<LettersTab onCreateCv={vi.fn()} />);
        const design = await screen.findByTestId("letters-group-cv-a");
        const thumb = within(design).getByTestId("letter-group-thumb");
        expect(thumb).toHaveAccessibleName(/Design CV/);
        fireEvent.click(thumb);
        expect(push).toHaveBeenCalledWith("/editor/cv-a");
    });

    it("folds a long group to two rows behind a Show all button, unless searching", async () => {
        await db.resumes.put(makeCv({ id: "cv-a", title: "Design CV" }));
        await db.coverLetters.bulkPut(Array.from({ length: 8 }, (_, index) => makeLetter({ id: `m${index}`, cvId: "cv-a", company: `Firm ${index}`, updatedAt: index })));
        render(<LettersTab onCreateCv={vi.fn()} />);
        const group = await screen.findByTestId("letters-group-cv-a");
        expect(within(group).getAllByTestId("letter-card")).toHaveLength(6); // two rows of three
        const toggle = within(group).getByTestId("letters-group-toggle");
        expect(toggle).toHaveTextContent("Show all 8 cover letters for this CV");

        fireEvent.click(toggle);
        expect(within(group).getAllByTestId("letter-card")).toHaveLength(8);
        fireEvent.click(within(group).getByTestId("letters-group-toggle"));
        expect(within(group).getAllByTestId("letter-card")).toHaveLength(6);

        fireEvent.change(screen.getByTestId("letters-search"), { target: { value: "Firm" } });
        expect(within(screen.getByTestId("letters-group-cv-a")).getAllByTestId("letter-card")).toHaveLength(8); // search results are never hidden
        expect(screen.queryByTestId("letters-group-toggle")).toBeNull();
    });

    it("puts letters whose CV is gone in their own group instead of hiding them", async () => {
        await seed();
        await db.resumes.delete("cv-b");
        render(<LettersTab onCreateCv={vi.fn()} />);
        const orphans = await screen.findByTestId("letters-group-none");
        expect(within(orphans).getAllByText(/Umbrella/).length).toBeGreaterThan(0);
    });

    it("searches across title, company, role and recipient, and says when nothing matches", async () => {
        await seed();
        render(<LettersTab onCreateCv={vi.fn()} />);
        const search = await screen.findByTestId("letters-search");

        fireEvent.change(search, { target: { value: "umbrella" } });
        expect(await screen.findAllByTestId("letter-card")).toHaveLength(1);
        expect(screen.queryByTestId("letters-group-cv-a")).toBeNull();

        fireEvent.change(search, { target: { value: "zzz" } });
        expect(await screen.findByTestId("letters-no-match")).toHaveTextContent("zzz");
    });

    it("offers the same density control as the other tabs", async () => {
        await seed();
        const onDensityChange = vi.fn();
        render(<LettersTab onCreateCv={vi.fn()} density="normal" onDensityChange={onDensityChange} />);
        fireEvent.click(await screen.findByTestId("letters-density-compact"));
        expect(onDensityChange).toHaveBeenCalledWith("compact");
    });

    it("duplicates a letter as a new draft under the same CV, leaving the original", async () => {
        await seed();
        render(<LettersTab onCreateCv={vi.fn()} />);
        await screen.findByTestId("letters-group-cv-a");
        fireEvent.click(within(card("a1")).getByTestId("letter-action-duplicate"));

        await waitFor(async () => expect(await db.coverLetters.count()).toBe(5), { timeout: 4000 });
        const copy = (await db.coverLetters.toArray()).find((letter) => /^Acme - Designer (.+)$/.test(letter.title));
        expect(copy).toMatchObject({ cvId: "cv-a", status: "draft" });
        expect((await db.coverLetters.get("a1"))?.company).toBe("Acme");
    });

    it("duplicates onto another CV and moves a draft to another CV, keeping its overrides and listing them", async () => {
        await seed();
        render(<LettersTab onCreateCv={vi.fn()} />);
        await screen.findByTestId("letters-group-cv-a");

        fireEvent.click(within(card("a1")).getByTestId("letter-action-duplicate-into"));
        let dialog = await screen.findByTestId("letter-repoint-dialog");
        fireEvent.click(within(dialog).getByTestId("letter-repoint-option-cv-b"));
        fireEvent.click(within(dialog).getByTestId("letter-repoint-confirm"));
        await waitFor(async () => expect((await db.coverLetters.toArray()).some((letter) => letter.id !== "a1" && letter.cvId === "cv-b" && letter.company === "Acme")).toBe(true), { timeout: 4000 });

        fireEvent.click(within(card("b1")).getByTestId("letter-action-repoint"));
        dialog = await screen.findByTestId("letter-repoint-dialog");
        // A move offers only the other CV, and says which overrides stay.
        expect(within(dialog).getAllByRole("radio")).toHaveLength(1);
        expect(within(dialog).getByTestId("letter-repoint-kept")).toHaveTextContent("Email");
        fireEvent.click(within(dialog).getByTestId("letter-repoint-confirm"));
        await waitFor(async () => expect((await db.coverLetters.get("b1"))?.cvId).toBe("cv-a"), { timeout: 4000 });
        expect((await db.coverLetters.get("b1"))?.senderOverrides).toEqual({ email: "work@umbrella.test" });
    });

    it("never offers to link a letter to more than one CV", async () => {
        await seed();
        render(<LettersTab onCreateCv={vi.fn()} />);
        await screen.findByTestId("letters-group-cv-a");
        fireEvent.click(within(card("a1")).getByTestId("letter-action-repoint"));
        const dialog = await screen.findByTestId("letter-repoint-dialog");
        expect(within(dialog).getByRole("radiogroup")).toBeInTheDocument();
        expect(dialog.querySelector("input[type=checkbox]")).toBeNull();
    });

    it("cannot move a sent letter", async () => {
        await db.resumes.put(makeCv({ id: "cv-a" }));
        await db.coverLetters.put(makeSentLetter({ id: "s1", cvId: "cv-a" }));
        render(<LettersTab onCreateCv={vi.fn()} />);
        await screen.findByTestId("letter-card");
        expect(screen.getByTestId("letter-action-repoint")).toBeDisabled();
    });

    it("deletes after confirmation, and the undo puts the identical letter back", async () => {
        await seed();
        const before = await db.coverLetters.get("a1");
        render(<LettersTab onCreateCv={vi.fn()} />);
        await screen.findByTestId("letters-group-cv-a");

        fireEvent.click(within(card("a1")).getByTestId("letter-action-delete"));
        expect(await db.coverLetters.get("a1")).toBeDefined(); // not yet: it asks first
        fireEvent.click(within(await screen.findByRole("dialog", {}, { timeout: 4000 })).getByRole("button", { name: "Delete letter" }));
        await waitFor(async () => expect(await db.coverLetters.get("a1")).toBeUndefined(), { timeout: 4000 });

        fireEvent.click(await screen.findByTestId("letter-undo-button", {}, { timeout: 4000 }));
        await waitFor(async () => expect(await db.coverLetters.get("a1")).toEqual(before), { timeout: 4000 });
        expect(screen.queryByTestId("letter-undo")).toBeNull();
    });

    it("says it is a record of a sent letter when deleting one", async () => {
        await db.resumes.put(makeCv({ id: "cv-a" }));
        await db.coverLetters.put(makeSentLetter({ id: "s1", cvId: "cv-a", company: "Acme", role: "Designer" }));
        render(<LettersTab onCreateCv={vi.fn()} />);
        await screen.findByTestId("letter-card");
        fireEvent.click(screen.getByTestId("letter-action-delete"));
        expect(await screen.findByText(/record of a letter you already sent/)).toBeInTheDocument();
    });
});
