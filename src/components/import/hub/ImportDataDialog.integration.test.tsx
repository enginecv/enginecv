import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { loadResumeHistory } from "@/lib/history";
import { useI18nStore } from "@/lib/i18n";
import { resumeWith } from "@/lib/import/staging/test-helpers";
import { createQaFullResume } from "@/lib/qa/sample-resumes";
import { DATA_EXPORT_FORMAT } from "@/lib/storage-registry/export-file";
import type { Resume } from "@/lib/schema";
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
}));

import { ImportDataDialog, type ImportDataDialogProps } from "./ImportDataDialog";

const job = (fields: Record<string, unknown> = {}) => ({ company: "Acme", position: "Engineer", start: "2020-03", ...fields });

function authoringFile(content: Record<string, unknown>, name: string) {
    return new File([JSON.stringify({ format: "enginecv.authoring/v1", basics: { name: "Jane Doe" }, ...content })], name);
}

async function addFiles(...files: File[]) {
    fireEvent.change(screen.getByTestId("import-hub-file-input"), { target: { files } });
    await waitFor(() => expect(screen.getAllByTestId("import-hub-batch")).toHaveLength(files.length));
}

function setup(overrides: Partial<ImportDataDialogProps> = {}, current: Resume = { ...resumeWith(), id: "cv-1" }) {
    const props: ImportDataDialogProps = {
        current,
        onApply: vi.fn(),
        onUndo: vi.fn(),
        onCreateNew: vi.fn().mockResolvedValue("new-id"),
        onOpenCreated: vi.fn(),
        onClose: vi.fn(),
        ...overrides,
    };
    render(<ImportDataDialog {...props} />);
    return props;
}

describe("ImportDataDialog", () => {
    beforeEach(async () => {
        await db.resumeHistory.clear();
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    afterEach(async () => {
        cleanup();
        await db.resumeHistory.clear();
    });

    it("opens on the sources step and lists every file source", () => {
        setup();
        expect(screen.getByRole("dialog", { name: "Import data" })).toBeInTheDocument();
        for (const id of ["enginecv", "jsonresume", "linkedin", "europass", "authoring", "paste-ai"]) {
            expect(screen.getByTestId(`import-hub-source-${id}`)).toBeInTheDocument();
        }
        expect(screen.getByTestId("import-hub-review")).toBeDisabled();
    });

    it("stages a detected file and shows what it holds", async () => {
        setup();
        await addFiles(authoringFile({ experience: [job()] }, "ai.json"));
        const batch = screen.getByTestId("import-hub-batch");
        expect(batch).toHaveTextContent("ai.json");
        expect(batch).toHaveTextContent("1 entry");
        expect(screen.getByTestId("import-hub-review")).toBeEnabled();
    });

    it("shows an error for an unreadable file and keeps the dialog open", async () => {
        const props = setup();
        fireEvent.change(screen.getByTestId("import-hub-file-input"), { target: { files: [new File(["hello"], "notes.txt")] } });
        expect(await screen.findByTestId("import-hub-error")).toHaveTextContent("notes.txt");
        expect(screen.getByRole("dialog", { name: "Import data" })).toBeInTheDocument();
        expect(props.onClose).not.toHaveBeenCalled();
    });

    it("keeps the good file when another one in the same drop fails", async () => {
        setup();
        fireEvent.change(screen.getByTestId("import-hub-file-input"), {
            target: { files: [authoringFile({ experience: [job()] }, "ai.json"), new File(["hello"], "notes.txt")] },
        });
        await waitFor(() => expect(screen.getAllByTestId("import-hub-batch")).toHaveLength(1));
        expect(screen.getByTestId("import-hub-error")).toHaveTextContent("notes.txt");
    });

    it("closes at once when nothing is staged", () => {
        const props = setup();
        fireEvent.click(screen.getByTestId("import-hub-close"));
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it("asks before discarding staged data", async () => {
        const props = setup();
        await addFiles(authoringFile({ experience: [job()] }, "ai.json"));
        fireEvent.click(screen.getByTestId("import-hub-close"));
        expect(props.onClose).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Discard" }));
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it("removes a staged source", async () => {
        setup();
        await addFiles(authoringFile({ experience: [job()] }, "ai.json"));
        fireEvent.click(screen.getByRole("button", { name: "Remove ai.json" }));
        expect(screen.queryByTestId("import-hub-batch")).not.toBeInTheDocument();
    });

    it("merges only what is ticked, snapshots first, and undoes", async () => {
        const current = { ...resumeWith({ experience: [job({ id: "mine", company: "Mine Co" })] }), id: "cv-1" };
        const props = setup({}, current);
        await addFiles(authoringFile({ experience: [job({ company: "Globex" }), job({ company: "Initech", start: "2010-01" })] }, "ai.json"));
        fireEvent.click(screen.getByTestId("import-hub-review"));

        const rows = screen.getAllByTestId("import-hub-row");
        expect(rows).toHaveLength(2);
        fireEvent.click(within(rows[1]).getByRole("checkbox"));
        expect(screen.getByTestId("import-hub-summary")).toHaveTextContent("1 entry will be added");

        fireEvent.click(screen.getByTestId("import-hub-apply"));
        await screen.findByTestId("import-hub-done");

        const applied = (props.onApply as ReturnType<typeof vi.fn>).mock.calls[0][0] as Resume;
        expect(applied.experience.map((entry) => entry.company)).toEqual(["Mine Co", "Globex"]);
        expect(await loadResumeHistory("cv-1")).toHaveLength(1);

        fireEvent.click(screen.getByTestId("import-hub-undo"));
        expect(props.onUndo).toHaveBeenCalledWith(current);
        expect(screen.getByRole("status")).toHaveTextContent("Undone");
    });

    it("shows one row for a job found in two sources and applies the chosen wording", async () => {
        const props = setup();
        await addFiles(
            authoringFile({ experience: [job({ description: "Short." })] }, "a.json"),
            authoringFile({ experience: [job({ company: "ACME Inc.", description: "A longer, fuller description." })] }, "b.json"),
        );
        fireEvent.click(screen.getByTestId("import-hub-review"));

        expect(screen.getAllByTestId("import-hub-row")).toHaveLength(1);
        expect(screen.getByTestId("import-hub-badge-several")).toHaveTextContent("Found in 2 sources");

        fireEvent.click(screen.getByRole("button", { name: /Choose between versions/ }));
        const wording = screen.getByRole("radio", { name: "Use for Description: a.json" });
        fireEvent.click(wording);
        fireEvent.click(screen.getByTestId("import-hub-apply"));
        await screen.findByTestId("import-hub-done");

        const applied = (props.onApply as ReturnType<typeof vi.fn>).mock.calls[0][0] as Resume;
        expect(applied.experience).toHaveLength(1);
        expect(applied.experience[0].description).toBe("Short.");
    });

    it("marks an entry that is already in the CV and leaves it unticked", async () => {
        const current = { ...resumeWith({ basics: { name: "Jane Doe" }, experience: [job({ id: "mine" })] }), id: "cv-1" };
        setup({}, current);
        await addFiles(authoringFile({ experience: [job()] }, "ai.json"));
        fireEvent.click(screen.getByTestId("import-hub-review"));
        expect(screen.getByTestId("import-hub-badge-existing")).toHaveTextContent("Already in your CV");
        expect(within(screen.getByTestId("import-hub-row")).getByRole("checkbox")).not.toBeChecked();
        expect(screen.getByTestId("import-hub-apply")).toBeDisabled();
    });

    it("lets the person choose between two values for their own details", async () => {
        const current = { ...resumeWith({ basics: { name: "Jane Doe", headline: "Engineer" } }), id: "cv-1" };
        const props = setup({}, current);
        await addFiles(authoringFile({ basics: { name: "Jane Doe", headline: "Staff Engineer" }, experience: [job()] }, "ai.json"));
        fireEvent.click(screen.getByTestId("import-hub-review"));
        fireEvent.click(screen.getByRole("radio", { name: "Use for Headline: ai.json" }));
        fireEvent.click(screen.getByTestId("import-hub-apply"));
        await screen.findByTestId("import-hub-done");
        expect((props.onApply as ReturnType<typeof vi.fn>).mock.calls[0][0].basics.headline).toBe("Staff Engineer");
    });

    it("asks for confirmation before replacing the CV", async () => {
        const props = setup();
        await addFiles(authoringFile({ experience: [job()] }, "ai.json"));
        fireEvent.click(screen.getByTestId("import-hub-review"));
        fireEvent.click(screen.getByTestId("import-hub-target-replace"));
        fireEvent.click(screen.getByTestId("import-hub-apply"));
        expect(props.onApply).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Replace" }));
        await screen.findByTestId("import-hub-done");
        expect(props.onApply).toHaveBeenCalledTimes(1);
    });

    it("creates a new CV and leaves the current one alone", async () => {
        const props = setup();
        await addFiles(authoringFile({ experience: [job()] }, "ai.json"));
        fireEvent.click(screen.getByTestId("import-hub-review"));
        fireEvent.click(screen.getByTestId("import-hub-target-new"));
        fireEvent.click(screen.getByTestId("import-hub-apply"));
        await screen.findByTestId("import-hub-open-created");
        expect(props.onCreateNew).toHaveBeenCalledTimes(1);
        expect(props.onApply).not.toHaveBeenCalled();
        fireEvent.click(screen.getByTestId("import-hub-open-created"));
        expect(props.onOpenCreated).toHaveBeenCalledWith("new-id");
    });

    it("changes nothing when applying fails", async () => {
        const props = setup({ onApply: vi.fn(() => { throw new Error("boom"); }) });
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        await addFiles(authoringFile({ experience: [job()] }, "ai.json"));
        fireEvent.click(screen.getByTestId("import-hub-review"));
        fireEvent.click(screen.getByTestId("import-hub-apply"));
        expect(await screen.findByRole("status")).toHaveTextContent("could not be applied");
        expect(props.onUndo).not.toHaveBeenCalled();
    });

    it("always creates a CV when the target is fixed to new", async () => {
        const props = setup({ target: "new" });
        await addFiles(authoringFile({ experience: [job()] }, "ai.json"));
        fireEvent.click(screen.getByTestId("import-hub-review"));
        expect(screen.queryByTestId("import-hub-target-merge")).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId("import-hub-apply"));
        await screen.findByTestId("import-hub-open-created");
        expect(props.onCreateNew).toHaveBeenCalledTimes(1);
    });

    it("stages a pasted AI answer", async () => {
        setup();
        fireEvent.change(screen.getByLabelText("Paste the answer here"), {
            target: { value: JSON.stringify({ format: "enginecv.authoring/v1", basics: { name: "Jane Doe" }, experience: [job()] }) },
        });
        fireEvent.click(screen.getByRole("button", { name: "Add" }));
        expect(await screen.findByTestId("import-hub-batch")).toHaveTextContent("Pasted text");
    });

    it("shows a loss summary beside a source that dropped data", async () => {
        setup();
        const resume = { basics: { name: "John Doe", label: "Dev", image: "https://example.com/photo.png" }, work: [{ name: "Acme", position: "Dev", startDate: "2020-01" }] };
        await addFiles(new File([JSON.stringify(resume)], "resume.json"));
        expect(within(screen.getByTestId("import-hub-batch")).getByTestId("conversion-loss-summary")).toBeInTheDocument();
    });

    it("saves every CV of a Download my data file as its own CV when the caller asks for that", async () => {
        const onImportDataExport = vi.fn().mockResolvedValue(undefined);
        const props = setup({ target: "new", onImportDataExport });
        const file = new File(
            [JSON.stringify({ format: DATA_EXPORT_FORMAT, data: { indexedDB: { EngineCVDatabase: { resumes: [createQaFullResume(), createQaFullResume()] } } } })],
            "my-data.json",
        );
        fireEvent.change(screen.getByTestId("import-hub-file-input"), { target: { files: [file] } });
        await waitFor(() => expect(onImportDataExport).toHaveBeenCalledTimes(1));
        expect(onImportDataExport.mock.calls[0][0]).toHaveLength(2);
        // Nothing is combined: no source is staged, and the window closes.
        await waitFor(() => expect(props.onClose).toHaveBeenCalled());
        expect(screen.queryByTestId("import-hub-batch")).not.toBeInTheDocument();
    });
});
