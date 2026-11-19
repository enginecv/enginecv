import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { resolveLetter } from "@/lib/letters/resolve";
import { useClientPreferencesStore } from "@/lib/preferences/store";
import { makeCv, makeLetter, makeSentLetter } from "../../../test/setup/letter-fixtures";
import { LetterExportMenu } from "./LetterExportMenu";

// Database-backed UI: give async queries room when the machine is busy.
configure({ asyncUtilTimeout: 4000 });

const { triggerPdfPrint, hasPreviewPages, waitForPreviewPages, exportToHtml, buildSelfContainedHtmlDocument, deliverFile, copyTextToClipboard } = vi.hoisted(() => ({
    triggerPdfPrint: vi.fn().mockResolvedValue(undefined),
    hasPreviewPages: vi.fn().mockReturnValue(true),
    waitForPreviewPages: vi.fn().mockResolvedValue(true),
    exportToHtml: vi.fn().mockResolvedValue([]),
    buildSelfContainedHtmlDocument: vi.fn().mockResolvedValue({ html: "<html>letter</html>" }),
    deliverFile: vi.fn().mockResolvedValue("download"),
    copyTextToClipboard: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/export", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/export")>()), triggerPdfPrint, hasPreviewPages, waitForPreviewPages, exportToHtml, buildSelfContainedHtmlDocument }));
vi.mock("@/lib/share", () => ({ deliverFile }));
vi.mock("@/lib/export-clipboard", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/export-clipboard")>()), copyTextToClipboard }));

/** jsdom's Blob has no .text(). */
const readBlob = (blob: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
});

const PHOTO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function openDialog(letter = makeLetter({ company: "Acme", role: "Designer" }), cv = makeCv()) {
    cleanup(); // a test may open the dialog more than once
    const onNeedPreview = vi.fn();
    render(<LetterExportMenu letter={resolveLetter(letter, cv)} onNeedPreview={onNeedPreview} />);
    fireEvent.click(screen.getByTestId("export-menu-button"));
    await screen.findByRole("dialog");
    return { onNeedPreview };
}

const choose = (format: string) => fireEvent.click(screen.getByTestId(`export-format-${format}`));
const confirm = () => fireEvent.click(screen.getByTestId("export-confirm-button"));

describe("LetterExportMenu (the CV's export dialog, with the letter's formats)", () => {
    beforeEach(() => {
        for (const mock of [triggerPdfPrint, exportToHtml, deliverFile, copyTextToClipboard]) mock.mockClear();
        hasPreviewPages.mockReturnValue(true);
        act(() => useI18nStore.setState({ locale: "en", _hydrated: true }));
    });
    afterEach(cleanup);

    it("opens the same dialog as the CV, with the formats a letter can have", async () => {
        await openDialog();
        const dialog = screen.getByRole("dialog");
        expect(dialog).toHaveAccessibleName(/export/i);
        const offered = within(dialog).getAllByTestId(/^export-format-(?!lossy)/).map((button) => button.getAttribute("data-testid"));
        expect(offered).toEqual(["pdf", "docx", "md", "txt", "tex", "html"].map((id) => `export-format-${id}`));
        expect(screen.queryByTestId("export-format-json")).toBeNull(); // CV data, not a letter format
    });

    it("prints a PDF from the preview pages at the letter's paper size, named after the job, then closes", async () => {
        await openDialog(makeLetter({ company: "Acme", role: "Designer", paperSize: "letter" }));
        choose("pdf");
        confirm();
        await waitFor(() => expect(triggerPdfPrint).toHaveBeenCalledTimes(1));
        expect(triggerPdfPrint.mock.calls[0][0]).toBe("letter");
        expect(triggerPdfPrint.mock.calls[0][1]).toBe("cover-letter-acme-designer.pdf");
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it("shows the preview first when it is hidden (a phone), as the CV export does", async () => {
        hasPreviewPages.mockReturnValue(false);
        const { onNeedPreview } = await openDialog();
        choose("pdf");
        expect(onNeedPreview).toHaveBeenCalled();
        confirm();
        await waitFor(() => expect(waitForPreviewPages).toHaveBeenCalled());
    });

    it("exports HTML through the same page-based path as the CV", async () => {
        await openDialog();
        choose("html");
        confirm();
        await waitFor(() => expect(exportToHtml).toHaveBeenCalledWith("a4", "cover-letter-acme-designer.html"));
    });

    it("exports plain text and Markdown with the live CV's sender for a draft", async () => {
        await openDialog(makeLetter({ paragraphs: [{ id: "a", markdown: "I am **bold**.", prompt: "" }] }), makeCv({ name: "Live Name" }));
        choose("txt");
        confirm();
        await waitFor(() => expect(deliverFile).toHaveBeenCalledTimes(1));
        const text = await readBlob(deliverFile.mock.calls[0][0] as Blob);
        expect(deliverFile.mock.calls[0][1]).toBe("cover-letter-acme-designer.txt");
        expect(text).toContain("Live Name");
        expect(text).toContain("I am bold.");
        expect(text).not.toContain("{{");

        await openDialog(makeLetter({ paragraphs: [{ id: "a", markdown: "I am **bold**.", prompt: "" }] }), makeCv({ name: "Live Name" }));
        choose("md");
        confirm();
        await waitFor(() => expect(deliverFile).toHaveBeenCalledTimes(2));
        expect(await readBlob(deliverFile.mock.calls[1][0] as Blob)).toContain("I am **bold**.");
    });

    it("exports the frozen sender for a sent letter, whatever the CV looks like now", async () => {
        await openDialog(makeSentLetter({ senderName: "Frozen Name", company: "Acme", role: "Designer" }), makeCv({ name: "Changed Since" }));
        choose("txt");
        confirm();
        await waitFor(() => expect(deliverFile).toHaveBeenCalledTimes(1));
        const text = await readBlob(deliverFile.mock.calls[0][0] as Blob);
        expect(text).toContain("Frozen Name");
        expect(text).not.toContain("Changed Since");
    });

    it("exports a Word file through the same delivery path", async () => {
        await openDialog();
        choose("docx");
        confirm();
        await waitFor(() => expect(deliverFile).toHaveBeenCalledTimes(1), { timeout: 8000 });
        expect(deliverFile.mock.calls[0][1]).toBe("cover-letter-acme-designer.docx");
        expect((deliverFile.mock.calls[0][0] as Blob).size).toBeGreaterThan(1000);
    });

    it("copies plain text, Markdown and HTML to the clipboard like the CV dialog", async () => {
        await openDialog();
        choose("txt");
        fireEvent.click(screen.getByTestId("export-copy-clipboard"));
        await waitFor(() => expect(copyTextToClipboard).toHaveBeenCalledTimes(1));
        expect(copyTextToClipboard.mock.calls[0][0]).toContain("Amina Hodzic");
        expect(await screen.findByText(/copied/i)).toBeInTheDocument();

        choose("html");
        fireEvent.click(screen.getByTestId("export-copy-clipboard"));
        await waitFor(() => expect(copyTextToClipboard).toHaveBeenCalledTimes(2));
        expect(await copyTextToClipboard.mock.calls[1][0]).toBe("<html>letter</html>");
    });

    it("lists what looks unfinished inside the dialog, and still lets the person export", async () => {
        await openDialog(makeLetter({ paragraphs: [{ id: "a", markdown: "Hi {{skills}}", prompt: "" }] }), makeCv({ email: "", skills: [] }));
        const notice = screen.getByTestId("letter-export-warnings");
        expect(notice).toHaveTextContent(/Email is empty/);
        expect(notice).toHaveTextContent(/skills token has nothing to show/);

        choose("txt");
        confirm();
        await waitFor(() => expect(deliverFile).toHaveBeenCalledTimes(1)); // no second dialog in the way
    });

    it("offers the photo option only when the letter shows a photo, and keeps the dialog open to say when it could not be included", async () => {
        await openDialog(makeLetter({ showPhoto: false }), makeCv({ photo: PHOTO }));
        choose("docx");
        expect(screen.queryByTestId("export-docx-include-photo")).toBeNull();
        cleanup();

        await openDialog(makeLetter({ showPhoto: true }), makeCv({ photo: "data:image/png;base64,@@@" }));
        choose("docx");
        fireEvent.click(screen.getByTestId("export-docx-include-photo"));
        confirm();
        expect(await screen.findByTestId("export-docx-photo-skipped", {}, { timeout: 8000 })).toBeInTheDocument();
        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("remembers the chosen format, like the CV dialog", async () => {
        await openDialog();
        choose("txt");
        confirm();
        await waitFor(() => expect(deliverFile).toHaveBeenCalled());
        expect(useClientPreferencesStore.getState().preferences.export.format).toBe("txt");
    });

    it("tells the person plainly when the export fails, and stays open", async () => {
        triggerPdfPrint.mockRejectedValueOnce(new Error("pop-up blocked"));
        await openDialog();
        choose("pdf");
        confirm();
        expect(await screen.findByTestId("letter-export-error")).toHaveTextContent("pop-up blocked");
        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("closes with Escape and with Cancel", async () => {
        await openDialog();
        fireEvent.keyDown(document, { key: "Escape" });
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });
});
