import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { csvFromRows, zipFileFromEntries } from "@/lib/import/linkedin/__fixtures__/archive-builder";
import { canonicalArchiveFile } from "@/lib/import/linkedin/__fixtures__/canonical";
import { LinkedinImportPanel } from "./LinkedinImportPanel";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
}));

async function upload(user: ReturnType<typeof userEvent.setup>, file: File) {
    await user.upload(screen.getByTestId("linkedin-file-input") as HTMLInputElement, file);
}

// The dialog tests cover the flow in depth; these cover the panel standing on a page.
describe("LinkedinImportPanel on a page", () => {
    beforeEach(() => {
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    afterEach(cleanup);

    it("renders without dialog chrome, labelled by the page heading", () => {
        render(
            <>
                <h1 id="page-title">LinkedIn to CV</h1>
                <LinkedinImportPanel onDone={vi.fn()} labelledBy="page-title" />
            </>,
        );

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByRole("region", { name: "LinkedIn to CV" })).toBeInTheDocument();
        expect(screen.getByTestId("linkedin-file-input")).toBeInTheDocument();
    });

    it("explains a connections-only export and offers a retry", async () => {
        const user = userEvent.setup({ applyAccept: false });
        render(<LinkedinImportPanel onDone={vi.fn()} />);

        await upload(user, zipFileFromEntries({
            "Connections.csv": csvFromRows(["First Name", "Last Name", "Company"], [{ "First Name": "A" }]),
        }));

        expect(await screen.findByTestId("linkedin-import-error")).toHaveTextContent("doesn't contain profile data");
        await user.click(screen.getByTestId("linkedin-import-retry"));
        expect(screen.getByTestId("linkedin-file-input")).toBeInTheDocument();
    });

    it("previews the archive, goes back on cancel, then saves and hands over the id", async () => {
        const user = userEvent.setup({ applyAccept: false });
        const onDone = vi.fn();
        const persistResume = vi.fn().mockResolvedValue("resume-2");
        render(<LinkedinImportPanel onDone={onDone} persistResume={persistResume} />);

        await upload(user, canonicalArchiveFile());
        await user.click(await screen.findByTestId("linkedin-import-cancel"));
        expect(screen.getByTestId("linkedin-file-input")).toBeInTheDocument();

        await upload(user, canonicalArchiveFile());
        await user.click(await screen.findByTestId("linkedin-import-confirm"));

        await waitFor(() => expect(onDone).toHaveBeenCalledWith("resume-2"));
        expect(persistResume.mock.calls[0][0].experience).toHaveLength(2);
    });
});
