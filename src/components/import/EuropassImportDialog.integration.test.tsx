import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { useI18nStore } from "@/lib/i18n";
import { candidateXml, europassPdf, skillsPassportXml } from "@/lib/import/europass/__fixtures__/europass-fixtures";
import { MAX_EUROPASS_BYTES } from "@/lib/import/europass/file";
import { EUROPASS_URL, EuropassImportDialog } from "./EuropassImportDialog";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: pushMock }),
}));

function setupUser() {
    // Drag-and-drop is not filtered by `accept`, so failure fixtures must reach the handler.
    return userEvent.setup({ applyAccept: false });
}

async function upload(user: ReturnType<typeof userEvent.setup>, file: File) {
    await user.upload(screen.getByTestId("europass-file-input") as HTMLInputElement, file);
}

describe("EuropassImportDialog", () => {
    beforeEach(async () => {
        await db.resumes.clear();
        await db.resumeHistory.clear();
        pushMock.mockClear();
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    afterEach(async () => {
        cleanup();
        await db.resumes.clear();
        await db.resumeHistory.clear();
    });

    it("guides the user to Europass and states the file stays local", () => {
        render(<EuropassImportDialog open onClose={vi.fn()} />);

        expect(screen.getByText("Download your CV from Europass")).toBeInTheDocument();
        expect(screen.getByText("Keep the original file")).toBeInTheDocument();
        const link = screen.getByTestId("europass-site-link");
        expect(link).toHaveAttribute("href", EUROPASS_URL);
        expect(link).toHaveAttribute("rel", "noopener noreferrer");
        expect(screen.getByTestId("europass-trademark-disclaimer")).toHaveTextContent("not affiliated");
    });

    it("previews a Europass PDF and creates a resume on confirm", async () => {
        const user = setupUser();
        const onImported = vi.fn();
        const onClose = vi.fn();
        render(<EuropassImportDialog open onClose={onClose} onImported={onImported} />);

        await upload(user, new File([europassPdf(candidateXml())], "Europass CV.pdf", { type: "application/pdf" }));

        expect(await screen.findByText("Here's what we found")).toBeInTheDocument();
        expect(screen.getByTestId("europass-preview-profile")).toHaveTextContent("Amina Kovačević");
        expect(screen.getByRole("img", { name: "Profile photo" })).toBeInTheDocument();
        expect(screen.getByTestId("europass-preview-section-experience")).toHaveTextContent("2 entries");
        expect(screen.getByTestId("europass-preview-section-languages")).toHaveTextContent("3 entries");
        expect(screen.getByTestId("europass-preview-section-other")).toHaveTextContent("3 sections");
        expect(screen.getByTestId("europass-preview-source")).toHaveTextContent("Europass PDF");
        expect(await db.resumes.count()).toBe(0);

        await user.click(screen.getByTestId("europass-import-confirm"));

        await waitFor(() => expect(pushMock).toHaveBeenCalledTimes(1));
        const [saved] = await db.resumes.toArray();
        expect(saved.basics.name).toBe("Amina Kovačević");
        expect(saved.meta.title).toBe("Amina Kovačević — Europass import");
        expect(pushMock).toHaveBeenCalledWith(`/editor/${saved.id}`);
        expect(onImported).toHaveBeenCalledWith(saved.id);
        expect(onClose).toHaveBeenCalled();
    });

    it("flags the legacy format when importing an old Europass XML file", async () => {
        const user = setupUser();
        render(<EuropassImportDialog open onClose={vi.fn()} />);

        await upload(user, new File([skillsPassportXml()], "cv.xml", { type: "application/xml" }));

        expect(await screen.findByTestId("europass-preview-source")).toHaveTextContent("older Europass format");
        expect(screen.getByTestId("europass-preview-profile")).toHaveTextContent("Site Reliability Engineer");
    });

    it("explains a PDF without Europass data and recovers on retry", async () => {
        const user = setupUser();
        render(<EuropassImportDialog open onClose={vi.fn()} />);

        await upload(user, new File([europassPdf(null)], "printed.pdf", { type: "application/pdf" }));

        expect(await screen.findByTestId("europass-import-error")).toHaveTextContent("No Europass CV data was found");
        await user.click(screen.getByTestId("europass-import-retry"));
        expect(screen.getByTestId("europass-import-guide")).toBeInTheDocument();
    });

    it("rejects files that are not Europass or too large", async () => {
        const user = setupUser();
        render(<EuropassImportDialog open onClose={vi.fn()} />);

        await upload(user, new File(["just some notes"], "notes.txt", { type: "text/plain" }));
        expect(await screen.findByTestId("europass-import-error")).toHaveTextContent("doesn't look like a Europass file");

        await user.click(screen.getByTestId("europass-import-retry"));
        const huge = new File(["x"], "huge.pdf", { type: "application/pdf" });
        Object.defineProperty(huge, "size", { value: MAX_EUROPASS_BYTES + 1 });
        await upload(user, huge);
        expect(await screen.findByTestId("europass-import-error")).toHaveTextContent("larger than 20 MB");
    });

    it("renders in Bosnian", () => {
        act(() => useI18nStore.setState({ locale: "bs", _hydrated: true }));
        render(<EuropassImportDialog open onClose={vi.fn()} />);

        expect(screen.getByText("Uvezite svoj Europass CV")).toBeInTheDocument();
        expect(screen.getByTestId("europass-trademark-disclaimer")).toHaveTextContent("inicijativa Evropske unije");
    });
});
