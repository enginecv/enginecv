import { act, cleanup, configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { useI18nStore } from "@/lib/i18n";
import { createLetterRecord, getLetter } from "@/lib/letters/store";
import { makeCv, resetLetterTables } from "../../../test/setup/letter-fixtures";
import { LetterEditor } from "./LetterEditor";

// Database-backed UI: give async queries room when the machine is busy.
configure({ asyncUtilTimeout: 4000 });

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/letters/x" }));

async function openEditor(cvOverrides: Parameters<typeof makeCv>[0] = {}, letterOptions: Parameters<typeof createLetterRecord>[1] = {}) {
    const cv = makeCv(cvOverrides);
    await db.resumes.put(cv);
    const letter = await createLetterRecord(cv.id!, letterOptions);
    render(<LetterEditor letterId={letter.id} />);
    await screen.findByTestId("letter-layout-pane");
    await screen.findAllByTestId("letter-page");
    return { cv, letter };
}

describe("LayoutPane", () => {
    beforeEach(async () => {
        await resetLetterTables();
        act(() => useI18nStore.setState({ locale: "en", _hydrated: true }));
    });
    afterEach(cleanup);

    it("preselects the German layout, on A4, for a German-language letter", async () => {
        await openEditor({ language: "de" });
        expect(screen.getByTestId("letter-layout")).toHaveValue("din5008");
        expect(screen.getByTestId("letter-paper")).toBeDisabled();
        expect(screen.getByTestId("letter-paper-hint")).toBeInTheDocument();
        expect(screen.getByTestId("letter-preview")).toHaveAttribute("data-layout", "din5008");
    });

    it("switches a Letter-size letter to A4 when the German layout is chosen, says so, and leaves the CV alone", async () => {
        const { cv, letter } = await openEditor({ language: "en" });
        fireEvent.change(screen.getByTestId("letter-paper"), { target: { value: "letter" } });
        await waitFor(() => expect(screen.getAllByTestId("letter-page")[0].style.width).toBe("816px"));

        fireEvent.change(screen.getByTestId("letter-layout"), { target: { value: "din5008" } });
        expect(await screen.findByTestId("letter-layout-notice")).toHaveTextContent(/Switched to A4/);
        await waitFor(() => expect(screen.getAllByTestId("letter-page")[0].style.width).toBe("794px"));
        expect(screen.getByTestId("letter-paper")).toBeDisabled();

        await waitFor(async () => expect(await getLetter(letter.id)).toMatchObject({ layout: "din5008", paperSize: "a4", paperSizeBeforeGerman: "letter" }), { timeout: 4000 });
        expect(await db.resumes.get(cv.id!)).toEqual(expect.objectContaining({ id: cv.id }));
        expect((await db.resumes.get(cv.id!))?.basics.name).toBe("Amina Hodzic");
    });

    it("brings the earlier paper size back when the standard layout is chosen again", async () => {
        await openEditor({ language: "en" });
        fireEvent.change(screen.getByTestId("letter-paper"), { target: { value: "letter" } });
        fireEvent.change(screen.getByTestId("letter-layout"), { target: { value: "din5008" } });
        await waitFor(() => expect(screen.getAllByTestId("letter-page")[0].style.width).toBe("794px"));

        fireEvent.change(screen.getByTestId("letter-layout"), { target: { value: "standard" } });
        await waitFor(() => expect(screen.getAllByTestId("letter-page")[0].style.width).toBe("816px"));
        expect(screen.getByTestId("letter-paper")).toHaveValue("letter");
        expect(screen.queryByTestId("letter-layout-notice")).toBeNull();
    });

    it("shows the print-marks option only under the German layout, and passes it to the preview", async () => {
        await openEditor({ language: "en" });
        expect(screen.queryByTestId("letter-print-fold-marks")).toBeNull();
        fireEvent.change(screen.getByTestId("letter-layout"), { target: { value: "din5008" } });
        fireEvent.click(await screen.findByTestId("letter-print-fold-marks"));
        await waitFor(() => expect(document.querySelectorAll(".letter-fold-mark-print").length).toBe(3));
    });

    it("turns the photo on for one letter, and warns when the CV has none", async () => {
        await openEditor();
        fireEvent.click(screen.getByTestId("letter-show-photo"));
        expect(await screen.findByText(/photo is switched on, but your CV has no photo/i)).toBeInTheDocument();
    });

    it("changes the letter language independently of the layout", async () => {
        const { letter } = await openEditor({ language: "en" });
        fireEvent.change(screen.getByTestId("letter-language"), { target: { value: "fr" } });
        await waitFor(async () => expect((await getLetter(letter.id))?.language).toBe("fr"), { timeout: 4000 });
        expect(screen.getByTestId("letter-layout")).toHaveValue("standard");
    });
});
