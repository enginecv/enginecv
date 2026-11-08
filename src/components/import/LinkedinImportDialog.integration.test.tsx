import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { useI18nStore } from "@/lib/i18n";
import { csvFromRows, fileFrom, zipFileFromEntries, zipFromEntries } from "@/lib/import/linkedin/__fixtures__/archive-builder";
import { canonicalArchiveFile, canonicalCsvEntries, SKILLS_HEADERS } from "@/lib/import/linkedin/__fixtures__/canonical";
import { MAX_IMPORT_BYTES } from "@/lib/import/linkedin/archive";
import { LinkedinImportDialog } from "./LinkedinImportDialog";

const { pushMock } = vi.hoisted(() => ({
    pushMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: pushMock,
    }),
}));

function setupUser() {
    // applyAccept off so failure-class fixtures (.txt) reach the handler,
    // mirroring a real drag-and-drop which browsers do not filter by accept.
    return userEvent.setup({ applyAccept: false });
}

async function uploadFiles(user: ReturnType<typeof userEvent.setup>, files: File[]): Promise<void> {
    const input = screen.getByTestId("linkedin-file-input") as HTMLInputElement;
    await user.upload(input, files);
}

describe("LinkedinImportDialog", () => {
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

    describe("guide (US2)", () => {
        it("renders the four guide steps, deep link, and own-data note", () => {
            render(<LinkedinImportDialog open onClose={vi.fn()} />);

            expect(screen.getByText("Request your data from LinkedIn")).toBeInTheDocument();
            expect(screen.getByText("Choose what to export")).toBeInTheDocument();
            expect(screen.getByText("Download the ZIP")).toBeInTheDocument();
            expect(screen.getByText("Drop it here")).toBeInTheDocument();

            const link = screen.getByTestId("linkedin-export-link");
            expect(link).toHaveAttribute(
                "href",
                "https://www.linkedin.com/mypreferences/d/download-my-data",
            );
            expect(link).toHaveAttribute("target", "_blank");
            expect(link).toHaveAttribute("rel", "noopener noreferrer");

            expect(screen.getByTestId("linkedin-own-data-note")).toBeInTheDocument();
            expect(screen.getByTestId("linkedin-drop-zone")).toBeInTheDocument();
        });

        it("renders the guide fully in the bs locale", () => {
            useI18nStore.setState({ locale: "bs", _hydrated: true });
            render(<LinkedinImportDialog open onClose={vi.fn()} />);

            expect(screen.getByText("Uvezite svoj LinkedIn profil")).toBeInTheDocument();
            expect(screen.getByText("Zatražite svoje podatke od LinkedIn-a")).toBeInTheDocument();
            expect(screen.getByText("Odaberite šta izvesti")).toBeInTheDocument();
            expect(screen.getByTestId("linkedin-trademark-disclaimer")).toHaveTextContent(
                "LinkedIn je zaštitni znak",
            );
        });
    });

    describe("import flow (US1)", () => {
        it("imports the canonical archive into a persisted resume and navigates to the editor", async () => {
            const user = setupUser();
            render(<LinkedinImportDialog open onClose={vi.fn()} />);

            await uploadFiles(user, [canonicalArchiveFile()]);

            await screen.findByText("Here's what we found");
            expect(screen.getByTestId("linkedin-preview-profile")).toHaveTextContent("Amina Kovačević");
            expect(screen.getByTestId("linkedin-preview-section-positions")).toHaveTextContent("2 entries");
            expect(screen.getByTestId("linkedin-preview-section-skills")).toHaveTextContent("3 entries");
            expect(screen.getByTestId("linkedin-preview-section-education")).toHaveTextContent("1 entry");
            expect(screen.queryByTestId("linkedin-preview-missing")).not.toBeInTheDocument();
            expect(screen.queryByTestId("linkedin-preview-skipped")).not.toBeInTheDocument();

            await user.click(screen.getByTestId("linkedin-import-confirm"));

            await waitFor(() => expect(pushMock).toHaveBeenCalledWith(expect.stringMatching(/^\/editor\//)));
            const resumes = await db.resumes.toArray();
            expect(resumes).toHaveLength(1);
            expect(resumes[0].basics.name).toBe("Amina Kovačević");
            expect(resumes[0].experience).toHaveLength(2);
            expect(resumes[0].experience[0].end).toBe("");
            expect(resumes[0].skillGroups[0].skills.map((skill) => skill.name)).toEqual(["TypeScript", "React", "C++"]);
            expect(resumes[0].settings.contentSections).toEqual([
                "experience",
                "education",
                "certificates",
                "projects",
                "skills",
                "languages",
            ]);
        });

        it("imports loose CSV files", async () => {
            const user = setupUser();
            const entries = canonicalCsvEntries();
            render(<LinkedinImportDialog open onClose={vi.fn()} />);

            await uploadFiles(user, [
                fileFrom(entries["Profile.csv"], "Profile.csv"),
                fileFrom(entries["Skills.csv"], "Skills.csv"),
            ]);

            await screen.findByText("Here's what we found");
            expect(screen.getByTestId("linkedin-preview-section-skills")).toHaveTextContent("3 entries");
            expect(screen.getByTestId("linkedin-preview-missing")).toBeInTheDocument();
        });

        it("cancel from preview persists nothing and closes", async () => {
            const user = setupUser();
            const onClose = vi.fn();
            render(<LinkedinImportDialog open onClose={onClose} />);

            await uploadFiles(user, [canonicalArchiveFile()]);
            await screen.findByText("Here's what we found");
            await user.click(screen.getByTestId("linkedin-import-cancel"));

            expect(onClose).toHaveBeenCalled();
            expect(await db.resumes.count()).toBe(0);
        });

        it("reopening after close starts back at the guide", async () => {
            const user = setupUser();
            const onClose = vi.fn();
            const { rerender } = render(<LinkedinImportDialog open onClose={onClose} />);

            await uploadFiles(user, [canonicalArchiveFile()]);
            await screen.findByText("Here's what we found");
            await user.click(screen.getByTestId("linkedin-import-cancel"));

            rerender(<LinkedinImportDialog open={false} onClose={onClose} />);
            rerender(<LinkedinImportDialog open onClose={onClose} />);

            expect(screen.getByTestId("linkedin-import-guide")).toBeInTheDocument();
            expect(screen.queryByText("Here's what we found")).not.toBeInTheDocument();
        });
    });

    describe("failure classes and partial archives (US3)", () => {
        it("shows the no-profile-data message for a connections-only export", async () => {
            const user = setupUser();
            render(<LinkedinImportDialog open onClose={vi.fn()} />);

            const connectionsOnly = zipFileFromEntries({
                "Connections.csv": csvFromRows(["First Name", "Last Name", "Company"], [{ "First Name": "A" }]),
            });
            await uploadFiles(user, [connectionsOnly]);

            const error = await screen.findByTestId("linkedin-import-error");
            expect(error).toHaveTextContent("doesn't contain profile data");
            expect(error).toHaveTextContent("see step 2");
            expect(await db.resumes.count()).toBe(0);
        });

        it("shows the corrupt-archive message for mangled ZIP bytes", async () => {
            const user = setupUser();
            render(<LinkedinImportDialog open onClose={vi.fn()} />);

            const intactBytes = zipFromEntries({ "Profile.csv": canonicalCsvEntries()["Profile.csv"] });
            const corrupted = intactBytes.slice(0, Math.floor(intactBytes.length / 2));
            await uploadFiles(user, [fileFrom(corrupted, "archive.zip")]);

            const error = await screen.findByTestId("linkedin-import-error");
            expect(error).toHaveTextContent("couldn't be read");
        });

        it("shows the unrecognized-file message for a non-ZIP, non-CSV file", async () => {
            const user = setupUser();
            render(<LinkedinImportDialog open onClose={vi.fn()} />);

            await uploadFiles(user, [fileFrom("plain text resume", "resume.txt")]);

            const error = await screen.findByTestId("linkedin-import-error");
            expect(error).toHaveTextContent("doesn't look like a LinkedIn export");
        });

        it("rejects oversized files before parsing", async () => {
            const user = setupUser();
            render(<LinkedinImportDialog open onClose={vi.fn()} />);

            const big = fileFrom("x", "huge.zip");
            Object.defineProperty(big, "size", { value: MAX_IMPORT_BYTES + 1 });
            await uploadFiles(user, [big]);

            const error = await screen.findByTestId("linkedin-import-error");
            expect(error).toHaveTextContent("larger than 50 MB");
        });

        it("disclosed partial import still confirms", async () => {
            const user = setupUser();
            render(<LinkedinImportDialog open onClose={vi.fn()} />);

            const skillsWithBlank = csvFromRows(SKILLS_HEADERS, [{ Name: "React" }, { Name: " " }]);
            await uploadFiles(user, [
                zipFileFromEntries({
                    "Profile.csv": canonicalCsvEntries()["Profile.csv"],
                    "Skills.csv": skillsWithBlank,
                }),
            ]);

            await screen.findByText("Here's what we found");
            expect(screen.getByTestId("linkedin-preview-missing")).toBeInTheDocument();
            expect(screen.getByTestId("linkedin-preview-skipped")).toHaveTextContent("1 entry");

            await user.click(screen.getByTestId("linkedin-import-confirm"));
            await waitFor(() => expect(pushMock).toHaveBeenCalled());
            const [resume] = await db.resumes.toArray();
            expect(resume.skillGroups[0].skills.map((skill) => skill.name)).toEqual(["React"]);
        });

        it("retry returns to the guide with the file cleared", async () => {
            const user = setupUser();
            render(<LinkedinImportDialog open onClose={vi.fn()} />);

            await uploadFiles(user, [fileFrom("nonsense", "resume.txt")]);
            await screen.findByTestId("linkedin-import-error");
            await user.click(screen.getByTestId("linkedin-import-retry"));

            expect(screen.getByTestId("linkedin-import-guide")).toBeInTheDocument();
            expect(screen.queryByTestId("linkedin-import-error")).not.toBeInTheDocument();
        });
    });

    describe("legal disclosures (US4)", () => {
        it("shows the trademark disclaimer in guide, preview, and error states", async () => {
            const user = setupUser();
            render(<LinkedinImportDialog open onClose={vi.fn()} />);

            expect(screen.getByTestId("linkedin-trademark-disclaimer")).toHaveTextContent(
                "LinkedIn is a trademark of LinkedIn Corporation.",
            );

            await uploadFiles(user, [canonicalArchiveFile()]);
            await screen.findByText("Here's what we found");
            expect(screen.getByTestId("linkedin-trademark-disclaimer")).toBeInTheDocument();
        });

        it("shows the trademark disclaimer in the error state and in a non-default locale", async () => {
            useI18nStore.setState({ locale: "de", _hydrated: true });
            const user = setupUser();
            render(<LinkedinImportDialog open onClose={vi.fn()} />);

            await uploadFiles(user, [fileFrom("nonsense", "resume.txt")]);
            await screen.findByTestId("linkedin-import-error");
            expect(screen.getByTestId("linkedin-trademark-disclaimer")).toHaveTextContent(
                "LinkedIn ist eine Marke der LinkedIn Corporation.",
            );
        });
    });
});
