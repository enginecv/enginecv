import { describe, expect, it } from "vitest";
import { buildCalendar, escapeText, foldLine } from "./calendar";
import { dateOnlyFormatter, instantFromWallTime, wallTimeIn } from "./dates";
import {
    addCalendarDays, addContact, addInterview, addTask, cancelOpenTasks, cancelTask, changeStage, completeTask, newApplication, removeContact, reopenTask, updateInterview,
    type InterviewInput,
} from "./operations";
import { jobApplicationSchema, type JobApplication } from "./schema";
import { actionCounts, dueState, filterApplications, EMPTY_FILTERS, nextAction, nextActionGroups, sortApplications } from "./selectors";

let counter = 0;
const ctx = (now = 1000) => ({ now, newId: () => `id-${++counter}` });
const job = (company = "Acme", stage: Parameters<typeof changeStage>[1] = "applied") => changeStage(newApplication({ company, role: "Designer" }, ctx()), stage, ctx());
const round = (overrides: Partial<InterviewInput> = {}): InterviewInput => ({ label: "First round", startsAt: null, endsAt: null, timeZone: "Europe/Berlin", location: null, link: null, contactIds: [], notes: "", outcome: "scheduled", ...overrides });

describe("tasks", () => {
    it("completes or cancels once, with one event each, and never both", () => {
        let app = addTask(job(), { title: " Follow up ", dueOn: "2026-11-27" }, ctx());
        const id = app.tasks[0].id;
        expect(app.tasks[0]).toMatchObject({ title: "Follow up", completedAt: null, cancelledAt: null });
        app = completeTask(app, id, ctx(2000));
        expect(app.tasks[0].completedAt).toBe(2000);
        expect(cancelTask(app, id, ctx())).toBe(app);
        expect(app.events.at(-1)).toMatchObject({ type: "task-completed", taskId: id });
        app = reopenTask(app, id);
        expect(app.tasks[0]).toMatchObject({ completedAt: null, cancelledAt: null });
        expect(jobApplicationSchema.safeParse(app).success).toBe(true);
    });

    it("cancels every open task on request, leaving done ones alone", () => {
        let app = addTask(addTask(job(), { title: "A", dueOn: null }, ctx()), { title: "B", dueOn: null }, ctx());
        app = completeTask(app, app.tasks[0].id, ctx());
        app = cancelOpenTasks(app, ctx(5000));
        expect(app.tasks.map((task) => [task.completedAt !== null, task.cancelledAt])).toEqual([[true, null], [false, 5000]]);
    });

    it("adds calendar days without any time zone", () => {
        expect(addCalendarDays("2026-03-25", 7)).toBe("2026-04-01");
        expect(addCalendarDays("2026-12-28", 7)).toBe("2027-01-04");
    });
});

describe("interviews", () => {
    it("moves Applied to Interviewing, but reopens a closed application only when asked", () => {
        expect(addInterview(job(), round(), ctx()).stage).toBe("interviewing");
        expect(addInterview(job("Acme", "saved"), round(), ctx()).stage).toBe("saved");
        expect(addInterview(job("Acme", "rejected"), round(), ctx()).stage).toBe("rejected");
        expect(addInterview(job("Acme", "rejected"), round(), ctx(), { reopen: true }).stage).toBe("interviewing");
    });

    it("records an outcome change as one event and ignores a save with no change", () => {
        const app = addInterview(job(), round(), ctx());
        const id = app.interviews[0].id;
        expect(updateInterview(app, id, round(), ctx())).toBe(app);
        const done = updateInterview(app, id, round({ outcome: "completed" }), ctx(9000));
        expect(done.interviews[0]).toMatchObject({ outcome: "completed", updatedAt: 9000 });
        expect(done.events.at(-1)).toMatchObject({ type: "interview-changed", outcome: "completed" });
    });

    it("drops a removed contact from the interviews that named it", () => {
        let app = addContact(job(), { name: "Amra", role: "Recruiter", email: null, phone: null, notes: null }, ctx());
        const contactId = app.contacts[0].id;
        app = addInterview(app, round({ contactIds: [contactId] }), ctx());
        app = removeContact(app, contactId);
        expect(app.interviews[0].contactIds).toEqual([]);
        expect(jobApplicationSchema.safeParse(app).success).toBe(true);
    });
});

describe("time zones", () => {
    it("converts a wall time in a zone to the right instant and back", () => {
        const result = instantFromWallTime("2026-11-30", "14:00", "Europe/Sarajevo");
        expect(result).toEqual({ status: "ok", instant: Date.UTC(2026, 10, 30, 13, 0) });
        expect(wallTimeIn(Date.UTC(2026, 10, 30, 13, 0), "America/New_York")).toEqual({ date: "2026-11-30", time: "08:00" });
    });

    it("reports times skipped by spring forward and doubled by fall back", () => {
        expect(instantFromWallTime("2026-03-29", "02:30", "Europe/Berlin")).toEqual({ status: "nonexistent" });
        expect(instantFromWallTime("2026-10-25", "02:30", "Europe/Berlin")).toEqual({ status: "ambiguous", instants: [Date.UTC(2026, 9, 25, 0, 30), Date.UTC(2026, 9, 25, 1, 30)] });
        expect(instantFromWallTime("2026-03-08", "02:30", "America/New_York")).toEqual({ status: "nonexistent" });
    });

    it("keeps an interview's instant when it spans a DST change", () => {
        // Booked in Berlin summer time for a date after the switch: still 10:00 on the day.
        const result = instantFromWallTime("2026-10-26", "10:00", "Europe/Berlin");
        expect(result.status === "ok" && wallTimeIn(result.instant, "Europe/Berlin")).toEqual({ date: "2026-10-26", time: "10:00" });
        expect(result).toEqual({ status: "ok", instant: Date.UTC(2026, 9, 26, 9, 0) });
    });

    it("prints date-only values on the same day in every zone", () => {
        expect(dateOnlyFormatter("en-US")("2026-03-29")).toBe("Mar 29, 2026");
    });
});

describe("next actions", () => {
    const today = "2026-11-26";
    const now = Date.UTC(2026, 10, 26, 12);

    it("groups open tasks by due state and keeps interviews until an outcome is recorded", () => {
        let a = addTask(job("A"), { title: "Overdue", dueOn: "2026-11-20" }, ctx());
        a = addTask(a, { title: "Today", dueOn: today }, ctx());
        a = addTask(a, { title: "Someday", dueOn: null }, ctx());
        let b = addInterview(job("B"), round({ startsAt: now - 86_400_000 }), ctx());
        b = addTask(b, { title: "Later", dueOn: "2026-12-01" }, ctx());
        const archived = { ...addTask(job("C"), { title: "Hidden", dueOn: today }, ctx()), archivedAt: 1 };
        const groups = nextActionGroups([a, b, archived], today);
        expect(groups.overdue.map((entry) => entry.task.title)).toEqual(["Overdue"]);
        expect(groups.today.map((entry) => entry.task.title)).toEqual(["Today"]);
        expect(groups.upcoming.map((entry) => entry.task.title)).toEqual(["Later", "Someday"]);
        expect(groups.interviews).toHaveLength(1);
        expect(actionCounts([a, b, archived], today, now)).toEqual({ due: 2, interviewsThisWeek: 0 });
    });

    it("picks the earliest thing to do and sorts by it", () => {
        const a = addTask(job("A"), { title: "Next week", dueOn: "2026-12-03" }, ctx());
        const b = addInterview(job("B"), round({ startsAt: Date.UTC(2026, 10, 28, 9) }), ctx());
        const c = job("C");
        expect(nextAction(a, today)).toMatchObject({ kind: "task", due: "upcoming" });
        expect(nextAction(b, today)).toMatchObject({ kind: "interview" });
        expect(nextAction(c, today)).toBeNull();
        expect(sortApplications([c, a, b], "next", "en", today).map((item) => item.company)).toEqual(["B", "A", "C"]);
        expect(dueState("2026-11-25", today)).toBe("overdue");
    });

    it("filters to applications with something due", () => {
        const a = addTask(job("A"), { title: "Today", dueOn: today }, ctx());
        const b = addTask(job("B"), { title: "Later", dueOn: "2026-12-01" }, ctx());
        expect(filterApplications([a, b], { ...EMPTY_FILTERS, dueOnly: true }, today).map((item) => item.company)).toEqual(["A"]);
    });
});

describe("calendar export", () => {
    const app = (): JobApplication => {
        let value = addContact(job("Acme, Inc."), { name: "Amra", role: "Recruiter", email: null, phone: null, notes: null }, ctx());
        value = addInterview(value, round({ label: "Tech; round", startsAt: Date.UTC(2026, 11, 2, 9), endsAt: Date.UTC(2026, 11, 2, 10), location: "Room 4\nFloor 2", link: "https://meet.example/x", contactIds: [value.contacts[0].id] }), ctx(1_800_000_000_000));
        return value;
    };

    it("writes UTC times, a stable UID, a rising sequence and escaped text", () => {
        const application = app();
        const interview = application.interviews[0];
        const ics = buildCalendar([{ application, interview }], Date.UTC(2026, 10, 26));
        expect(ics).toContain(`UID:${interview.id}@jobs.enginecv.app\r\n`);
        expect(ics).toContain("DTSTART:20261202T090000Z\r\n");
        expect(ics).toContain("DTEND:20261202T100000Z\r\n");
        expect(ics).toContain("SEQUENCE:1800000000\r\n");
        expect(ics).toContain("SUMMARY:Tech\\; round – Acme\\, Inc.\r\n");
        expect(ics).toContain("LOCATION:Room 4\\nFloor 2\r\n");
        expect(ics).toContain("STATUS:CONFIRMED");
        expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    });

    it("marks a cancelled round as cancelled under the same UID", () => {
        const application = app();
        const cancelled = updateInterview(application, application.interviews[0].id, { ...application.interviews[0], outcome: "cancelled" }, ctx(1_900_000_000_000));
        const ics = buildCalendar([{ application: cancelled, interview: cancelled.interviews[0] }]);
        expect(ics).toContain("STATUS:CANCELLED");
        expect(ics).toContain(`UID:${application.interviews[0].id}@`);
        expect(ics).toContain("SEQUENCE:1900000000");
    });

    it("escapes and folds long lines without splitting characters", () => {
        expect(escapeText("a\\b;c,d\ne")).toBe("a\\\\b\\;c\\,d\\ne");
        const folded = foldLine(`DESCRIPTION:${"ž".repeat(60)}`);
        for (const line of folded.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
        expect(folded.split("\r\n ").join("")).toBe(`DESCRIPTION:${"ž".repeat(60)}`);
    });
});
