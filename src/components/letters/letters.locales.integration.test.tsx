import { act, cleanup, configure, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LettersTab } from "@/components/dashboard/LettersTab";
import { db } from "@/lib/db";
import { useI18nStore, type Locale } from "@/lib/i18n";
import { createLetterRecord } from "@/lib/letters/store";
import { makeCv, makeLetter, makeSentLetter, resetLetterTables } from "../../../test/setup/letter-fixtures";
import { DeleteCvDialog } from "./DeleteCvDialog";
import { LetterEditor } from "./LetterEditor";

// Database-backed UI: give async queries room when the machine is busy.
configure({ asyncUtilTimeout: 4000 });

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/letters/x" }));

/** A translation key that was not found is printed as the key itself. */
const RAW_KEY = /\b(?:letters|dashboard\.letters|editor)\.[a-zA-Z]+(?:\.[a-zA-Z]+)*\b/;

const LOCALES: Locale[] = ["de", "fr", "es", "bs"];

describe.each(LOCALES)("cover letters in %s", (locale) => {
    beforeEach(async () => {
        await resetLetterTables();
        act(() => useI18nStore.setState({ locale, _hydrated: true }));
    });
    afterEach(cleanup);

    it("shows the editor, with its panes, dialogs' triggers and statuses, in the language and with no raw keys", async () => {
        const cv = makeCv({ language: locale });
        await db.resumes.put(cv);
        const letter = await createLetterRecord(cv.id!, { company: "Acme" });
        render(<LetterEditor letterId={letter.id} />);
        await screen.findByTestId("letter-layout-pane");
        await screen.findAllByTestId("letter-page");

        expect(document.body.textContent).not.toMatch(RAW_KEY);
        expect(screen.getByTestId("letter-mark-sent")).not.toHaveTextContent("Mark as sent");
        expect(screen.getByTestId("letter-status-chip")).not.toHaveTextContent("Draft");
    });

    it("writes the letter's own text in the letter's language, whatever the interface language", async () => {
        const cv = makeCv({ language: "en" });
        await db.resumes.put(cv);
        const letter = await createLetterRecord(cv.id!, { language: locale });
        expect(letter.language).toBe(locale);
        expect(letter.salutation).not.toBe("Dear Hiring Manager,");
        expect(letter.paragraphs).toHaveLength(1);
    });

    it("shows the dashboard tab with its groups and actions with no raw keys", async () => {
        await db.resumes.put(makeCv({ id: "cv-a", title: "Design CV" }));
        await db.coverLetters.bulkPut([makeLetter({ id: "a", cvId: "cv-a" }), makeSentLetter({ id: "s", cvId: null })]);
        render(<LettersTab onCreateCv={vi.fn()} onDensityChange={vi.fn()} />);
        await screen.findAllByTestId("letter-card");
        expect(document.body.textContent).not.toMatch(RAW_KEY);
    });

    it("shows the delete-CV dialog with no raw keys", () => {
        render(<DeleteCvDialog cvName="Old CV" letters={[makeLetter({ id: "d1" }), makeSentLetter({ id: "s1" })]} otherCvs={[{ id: "x", label: "Other" }]} busy={false} error={true} onConfirm={vi.fn()} onCancel={vi.fn()} />);
        expect(document.body.textContent).not.toMatch(RAW_KEY);
        expect(screen.getByTestId("delete-cv-error")).toBeInTheDocument();
    });
});
