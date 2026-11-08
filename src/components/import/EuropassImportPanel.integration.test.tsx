import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { candidateXml, europassPdf } from "@/lib/import/europass/__fixtures__/europass-fixtures";
import { EuropassImportPanel } from "./EuropassImportPanel";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
}));

async function upload(user: ReturnType<typeof userEvent.setup>, file: File) {
    await user.upload(screen.getByTestId("europass-file-input") as HTMLInputElement, file);
}

// The dialog tests cover the flow in depth; these cover the panel standing on a page.
describe("EuropassImportPanel on a page", () => {
    beforeEach(() => {
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    afterEach(cleanup);

    it("renders without dialog chrome, labelled by the page heading", () => {
        render(
            <>
                <h1 id="page-title">Convert your Europass CV</h1>
                <EuropassImportPanel onDone={vi.fn()} labelledBy="page-title" />
            </>,
        );

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByRole("region", { name: "Convert your Europass CV" })).toBeInTheDocument();
        expect(screen.getByTestId("europass-drop-zone")).toBeInTheDocument();
    });

    it("goes back to the drop zone on cancel when the host gives no cancel handler", async () => {
        const user = userEvent.setup({ applyAccept: false });
        render(<EuropassImportPanel onDone={vi.fn()} persistResume={vi.fn()} />);

        await upload(user, new File([europassPdf(candidateXml())], "cv.pdf", { type: "application/pdf" }));
        await user.click(await screen.findByTestId("europass-import-cancel"));

        expect(screen.getByTestId("europass-drop-zone")).toBeInTheDocument();
    });

    it("saves on confirm and hands the id to the host, reporting busy while saving", async () => {
        const user = userEvent.setup({ applyAccept: false });
        const onDone = vi.fn();
        const onBusyChange = vi.fn();
        const persistResume = vi.fn().mockResolvedValue("resume-1");
        render(<EuropassImportPanel onDone={onDone} onBusyChange={onBusyChange} persistResume={persistResume} />);

        await upload(user, new File([europassPdf(candidateXml())], "cv.pdf", { type: "application/pdf" }));
        await user.click(await screen.findByTestId("europass-import-confirm"));

        await waitFor(() => expect(onDone).toHaveBeenCalledWith("resume-1"));
        expect(persistResume.mock.calls[0][0].basics.name).toBe("Amina Kovačević");
        expect(onBusyChange).toHaveBeenCalledWith(true);
    });

    it("shows the error and retry when saving fails", async () => {
        const user = userEvent.setup({ applyAccept: false });
        const onDone = vi.fn();
        render(<EuropassImportPanel onDone={onDone} persistResume={vi.fn().mockRejectedValue(new Error("quota"))} />);

        await upload(user, new File([europassPdf(candidateXml())], "cv.pdf", { type: "application/pdf" }));
        await user.click(await screen.findByTestId("europass-import-confirm"));

        expect(await screen.findByTestId("europass-import-retry")).toBeInTheDocument();
        expect(onDone).not.toHaveBeenCalled();
    });
});
