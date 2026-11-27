import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { useI18nStore } from "@/lib/i18n";
import { addTask, changeStage, defaultContext, newApplication } from "@/lib/jobs/operations";
import { insertApplication } from "@/lib/jobs/repository";
import { useClientPreferencesStore } from "@/lib/preferences/store";
import { JobsTab } from "./JobsTab";
import { makeCv } from "../../../test/setup/letter-fixtures";

configure({ asyncUtilTimeout: 4000 });

let search = "";
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
    usePathname: () => "/dashboard",
    useSearchParams: () => new URLSearchParams(search),
}));

async function seed(company: string, role: string, stage: Parameters<typeof changeStage>[1] = "saved") {
    const ctx = defaultContext();
    const created = newApplication({ company, role }, ctx);
    return insertApplication(stage === "saved" ? created : changeStage(created, stage, ctx));
}

describe("JobsTab", () => {
    beforeEach(async () => {
        search = "";
        window.history.replaceState(null, "", "/dashboard");
        await Promise.all([db.jobApplications.clear(), db.jobSubmissionPackets.clear(), db.resumes.clear(), db.coverLetters.clear()]);
        act(() => {
            useI18nStore.setState({ locale: "en", _hydrated: true });
            useClientPreferencesStore.getState().updateSection("dashboard", { jobsView: "board" });
        });
    });
    afterEach(cleanup);

    it("starts empty, adds a job with only company and role, and opens it", async () => {
        render(<JobsTab />);
        fireEvent.click(await screen.findByTestId("jobs-empty-add"));
        const dialog = screen.getByTestId("add-job-dialog");
        fireEvent.click(within(dialog).getByTestId("add-job-save"));
        expect(within(dialog).getByTestId("add-job-company-error")).toHaveTextContent("Required.");
        expect(await db.jobApplications.count()).toBe(0);

        fireEvent.change(within(dialog).getByTestId("add-job-company"), { target: { value: "Acme" } });
        fireEvent.change(within(dialog).getByTestId("add-job-role"), { target: { value: "Designer" } });
        fireEvent.click(within(dialog).getByTestId("add-job-save"));

        const details = await screen.findByTestId("job-details");
        expect(within(details).getByRole("heading", { name: "Designer" })).toBeInTheDocument();
        const [stored] = await db.jobApplications.toArray();
        expect(stored).toMatchObject({ company: "Acme", role: "Designer", stage: "saved", jobUrl: null });
        expect(window.location.search).toBe(`?tab=jobs&application=${stored.id}`);
        expect(window.location.search).not.toContain("Acme");

        fireEvent.click(within(details).getByTestId("job-details-close"));
        await waitFor(() => expect(screen.queryByTestId("job-details")).toBeNull());
        expect(window.location.search).toBe("?tab=jobs");
        expect(within(screen.getByTestId("job-column-saved")).getByText("Designer")).toBeInTheDocument();
    });

    it("rejects links that are not http(s) and warns about a possible duplicate", async () => {
        await seed("Acme", "Designer");
        render(<JobsTab />);
        await screen.findByTestId("job-board");
        fireEvent.click(screen.getByTestId("jobs-add"));
        const dialog = await screen.findByTestId("add-job-dialog");
        fireEvent.change(within(dialog).getByTestId("add-job-company"), { target: { value: "acme" } });
        fireEvent.change(within(dialog).getByTestId("add-job-role"), { target: { value: " Designer" } });
        fireEvent.change(within(dialog).getByTestId("add-job-jobUrl"), { target: { value: "javascript:alert(1)" } });
        fireEvent.click(within(dialog).getByTestId("add-job-save"));
        expect(within(dialog).getByTestId("add-job-jobUrl-error")).toBeInTheDocument();

        fireEvent.change(within(dialog).getByTestId("add-job-jobUrl"), { target: { value: "" } });
        fireEvent.click(within(dialog).getByTestId("add-job-save"));
        expect(await within(dialog).findByTestId("add-job-duplicate")).toHaveTextContent("Designer · Acme");
        fireEvent.click(within(dialog).getByTestId("add-job-save-anyway"));
        await screen.findByTestId("job-details");
        expect(await db.jobApplications.count()).toBe(2);
    });

    it("changes a stage by menu, announces it, and records one event", async () => {
        const job = await seed("Acme", "Designer");
        render(<JobsTab />);
        fireEvent.click(await screen.findByTestId(`job-card-stage-${job.id}`));
        fireEvent.click(await screen.findByTestId(`job-card-stage-${job.id}-applied`));
        await waitFor(async () => expect((await db.jobApplications.get(job.id))?.stage).toBe("applied"));
        await waitFor(() => expect(screen.getByTestId("jobs-announcer")).toHaveTextContent("Moved Designer · Acme to Applied."));
        const stored = await db.jobApplications.get(job.id);
        expect(stored?.events.map((event) => event.type)).toEqual(["created", "stage-changed"]);
        expect(stored?.submissions).toEqual([]);
        expect(within(await screen.findByTestId("job-column-applied")).getByText("Designer")).toBeInTheDocument();
    });

    it("keeps closed stages out of the board until asked, and lists them in the list view", async () => {
        await seed("Initech", "Analyst", "rejected");
        await seed("Acme", "Designer");
        render(<JobsTab />);
        await screen.findByTestId("job-board");
        expect(screen.queryByTestId("job-column-rejected")).toBeNull();
        expect(screen.getByText("Closed: Accepted 0 · Rejected 1 · Withdrawn 0")).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("job-board-toggle-closed"));
        expect(within(screen.getByTestId("job-column-rejected")).getByText("Analyst")).toBeInTheDocument();

        fireEvent.click(screen.getByTestId("jobs-view-list"));
        expect(await screen.findAllByTestId("job-row")).toHaveLength(2);
        expect(useClientPreferencesStore.getState().preferences.dashboard.jobsView).toBe("list");
    });

    it("archives, trashes and restores a job without losing its stage", async () => {
        const job = await seed("Acme", "Designer", "interviewing");
        search = `tab=jobs&application=${job.id}`;
        render(<JobsTab />);
        const details = await screen.findByTestId("job-details");
        fireEvent.click(within(details).getByTestId("job-details-archive"));
        await waitFor(async () => expect((await db.jobApplications.get(job.id))?.archivedAt).not.toBeNull());
        fireEvent.click(await within(details).findByTestId("job-details-trash"));
        await waitFor(() => expect(screen.queryByTestId("job-details")).toBeNull());

        fireEvent.click(await screen.findByTestId("jobs-open-trash"));
        fireEvent.click(await screen.findByTestId(`job-row-open-${job.id}`));
        fireEvent.click(await screen.findByTestId("job-details-restore"));
        await waitFor(async () => expect((await db.jobApplications.get(job.id))?.trashedAt).toBeNull());
        const stored = await db.jobApplications.get(job.id);
        expect(stored).toMatchObject({ stage: "interviewing" });
        expect(stored?.events.map((event) => event.type)).toEqual(["created", "stage-changed", "archived", "trashed", "restored"]);
    });

    it("autosaves edits and keeps them when another tab saved first", async () => {
        const job = await seed("Acme", "Designer");
        search = `tab=jobs&application=${job.id}`;
        render(<JobsTab />);
        const details = await screen.findByTestId("job-details");
        fireEvent.change(within(details).getByTestId("job-details-location"), { target: { value: "Sarajevo" } });
        await waitFor(() => expect(within(details).getByTestId("job-details-save-state")).toHaveTextContent("Saved locally"));
        expect((await db.jobApplications.get(job.id))?.location).toBe("Sarajevo");

        // Another tab moves the stage while this one edits notes.
        const current = (await db.jobApplications.get(job.id))!;
        fireEvent.change(within(details).getByTestId("job-details-notesMarkdown"), { target: { value: "Call Amra" } });
        await db.jobApplications.put({ ...current, stage: "applied", revision: current.revision + 1 });
        expect(await within(details).findByTestId("job-details-conflict")).toBeInTheDocument();
        expect(within(details).getByTestId("job-details-notesMarkdown")).toHaveValue("Call Amra");

        fireEvent.click(within(details).getByTestId("job-details-reapply"));
        await waitFor(async () => expect((await db.jobApplications.get(job.id))?.notesMarkdown).toBe("Call Amra"));
        expect((await db.jobApplications.get(job.id))?.stage).toBe("applied");
    });

    it("links a CV, writes a letter for the job, and records what was sent", async () => {
        await db.resumes.put({ ...makeCv({ id: "cv-1", title: "Design CV" }), updatedAt: 5 });
        const job = await seed("Acme", "Designer");
        search = `tab=jobs&application=${job.id}`;
        render(<JobsTab />);
        const details = await screen.findByTestId("job-details");
        fireEvent.click(within(details).getByTestId("job-details-prepare"));

        fireEvent.click(await within(details).findByTestId("working-cv-link"));
        expect(await within(details).findByTestId("working-cv-title")).toHaveTextContent("Design CV");
        fireEvent.click(within(details).getByTestId("working-letter-create"));
        expect(await within(details).findByTestId("working-letter-title")).toHaveTextContent("Acme - Designer");
        const linked = await db.jobApplications.get(job.id);
        expect(linked?.workingCvId).toBe("cv-1");
        expect((await db.coverLetters.get(linked!.workingLetterId!))).toMatchObject({ cvId: "cv-1", company: "Acme", role: "Designer", status: "draft" });
        expect(within(details).getByTestId("working-letter-open")).toHaveAttribute("href", `/letters/${linked!.workingLetterId}?job=${job.id}`);

        fireEvent.click(within(details).getByTestId("record-open"));
        const dialog = await screen.findByTestId("record-dialog");
        fireEvent.click(within(dialog).getByTestId("record-save"));
        expect(await within(details).findByTestId("submission")).toBeInTheDocument();
        const stored = await db.jobApplications.get(job.id);
        expect(stored).toMatchObject({ stage: "applied", submissions: [{ cv: { status: "captured", capturedTitle: "Design CV" }, letter: { status: "captured" } }] });
        // The working letter is not marked as sent by recording.
        expect((await db.coverLetters.get(stored!.workingLetterId!))?.status).toBe("draft");
        fireEvent.click(within(details).getByTestId("submission-view"));
        expect(await screen.findByTestId("evidence-dialog")).toBeInTheDocument();
    });

    it("adds and completes a task, and schedules an interview that moves Applied to Interviewing", async () => {
        const job = await seed("Acme", "Designer", "applied");
        search = `tab=jobs&application=${job.id}`;
        render(<JobsTab />);
        const details = await screen.findByTestId("job-details");
        fireEvent.change(within(details).getByTestId("task-title"), { target: { value: "Send portfolio" } });
        fireEvent.change(within(details).getByTestId("task-due"), { target: { value: "2026-12-01" } });
        fireEvent.click(within(details).getByTestId("task-add"));
        expect(await within(details).findByText("Send portfolio")).toBeInTheDocument();
        fireEvent.click(within(details).getByTestId("task-complete"));
        await waitFor(async () => expect((await db.jobApplications.get(job.id))?.tasks[0].completedAt).not.toBeNull());
        expect((await db.jobApplications.get(job.id))?.events.at(-1)?.type).toBe("task-completed");

        fireEvent.click(within(details).getByTestId("interview-add"));
        const dialog = await screen.findByTestId("interview-dialog");
        fireEvent.change(within(dialog).getByTestId("interview-date"), { target: { value: "2026-12-02" } });
        fireEvent.change(within(dialog).getByTestId("interview-start"), { target: { value: "10:00" } });
        fireEvent.change(within(dialog).getByTestId("interview-zone"), { target: { value: "Europe/Berlin" } });
        fireEvent.click(within(dialog).getByTestId("interview-save"));
        await waitFor(() => expect(screen.queryByTestId("interview-dialog")).toBeNull());
        const stored = await db.jobApplications.get(job.id);
        expect(stored).toMatchObject({ stage: "interviewing", interviews: [{ startsAt: Date.UTC(2026, 11, 2, 9), timeZone: "Europe/Berlin", outcome: "scheduled" }] });
    });

    it("refuses an interview time the clocks skip", async () => {
        const job = await seed("Acme", "Designer", "applied");
        search = `tab=jobs&application=${job.id}`;
        render(<JobsTab />);
        fireEvent.click(await screen.findByTestId("interview-add"));
        const dialog = await screen.findByTestId("interview-dialog");
        fireEvent.change(within(dialog).getByTestId("interview-date"), { target: { value: "2026-03-29" } });
        fireEvent.change(within(dialog).getByTestId("interview-start"), { target: { value: "02:30" } });
        fireEvent.change(within(dialog).getByTestId("interview-zone"), { target: { value: "Europe/Berlin" } });
        fireEvent.click(within(dialog).getByTestId("interview-save"));
        expect(await within(dialog).findByTestId("interview-error")).toHaveTextContent("does not exist");
        expect((await db.jobApplications.get(job.id))?.interviews).toEqual([]);
    });

    it("asks before closing a job with open tasks, keeping them by default", async () => {
        const ctx = defaultContext();
        const job = await insertApplication(addTask(newApplication({ company: "Acme", role: "Designer" }, ctx), { title: "Call back", dueOn: null }, ctx));
        render(<JobsTab />);
        fireEvent.click(await screen.findByTestId(`job-card-stage-${job.id}`));
        fireEvent.click(await screen.findByTestId(`job-card-stage-${job.id}-rejected`));
        fireEvent.click(await screen.findByText("Move and cancel 1 task"));
        await waitFor(async () => expect((await db.jobApplications.get(job.id))?.stage).toBe("rejected"));
        expect((await db.jobApplications.get(job.id))?.tasks[0].cancelledAt).not.toBeNull();
    });

    it("lists due tasks and interviews in Next actions and counts them", async () => {
        const ctx = defaultContext();
        await insertApplication(addTask(newApplication({ company: "Acme", role: "Designer" }, ctx), { title: "Overdue thing", dueOn: "2020-01-01" }, ctx));
        render(<JobsTab />);
        expect(await screen.findByTestId("jobs-summary-due")).toHaveTextContent("1");
        expect(screen.getByTestId("job-card-next")).toHaveTextContent("Next: Overdue thing");
        fireEvent.click(screen.getByTestId("jobs-view-actions"));
        const overdue = await screen.findByTestId("actions-overdue");
        expect(within(overdue).getByText("Overdue thing")).toBeInTheDocument();
        expect(screen.getByText(/Reminders appear when you open EngineCV/)).toBeInTheDocument();
        fireEvent.click(within(overdue).getByTestId("action-task-complete"));
        expect(await screen.findByTestId("actions-empty")).toBeInTheDocument();
    });

    it("explains a link to an application that does not exist", async () => {
        await seed("Acme", "Designer");
        search = "tab=jobs&application=missing";
        render(<JobsTab />);
        expect(await screen.findByTestId("job-not-found")).toBeInTheDocument();
    });

    it("speaks German", async () => {
        await seed("Acme", "Designer");
        act(() => useI18nStore.setState({ locale: "de", _hydrated: true }));
        render(<JobsTab />);
        expect(within(await screen.findByTestId("job-column-saved")).getByRole("heading")).toHaveTextContent("Gemerkt");
        expect(screen.getByTestId("jobs-add")).toHaveTextContent("Stelle hinzufügen");
    });
});
