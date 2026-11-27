import { describe, expect, it } from "vitest";
import { z } from "zod";
import { newApplication } from "./operations";
import { dateOnlySchema, jobApplicationSchema, portableJobApplicationSchema, type JobApplication } from "./schema";

let counter = 0;
const ctx = { now: Date.UTC(2026, 10, 20, 9, 30), newId: () => `id-${++counter}` };
const base = (): JobApplication => newApplication({ company: "Acme", role: "Designer" }, ctx);

describe("job application schema", () => {
    it("accepts a freshly created application", () => {
        expect(jobApplicationSchema.safeParse(base()).success).toBe(true);
    });

    it("treats a missing list as invalid instead of empty", () => {
        const withoutSubmissions: Partial<JobApplication> = base();
        delete withoutSubmissions.submissions;
        expect(jobApplicationSchema.safeParse(withoutSubmissions).success).toBe(false);
    });

    it("rejects links that are not http or https", () => {
        expect(jobApplicationSchema.safeParse({ ...base(), jobUrl: "javascript:alert(1)" }).success).toBe(false);
        expect(jobApplicationSchema.safeParse({ ...base(), jobUrl: "https://jobs.example/1" }).success).toBe(true);
    });

    it("checks calendar dates, not only their shape", () => {
        expect(dateOnlySchema.safeParse("2026-02-29").success).toBe(false);
        expect(dateOnlySchema.safeParse("2028-02-29").success).toBe(true);
        expect(dateOnlySchema.safeParse("2026-11-20T00:00").success).toBe(false);
    });

    it("keeps compensation coherent", () => {
        const pay = (min: number | null, max: number | null) => ({ ...base(), compensation: { min, max, currency: "EUR", period: "year" as const } });
        expect(jobApplicationSchema.safeParse(pay(50000, 60000)).success).toBe(true);
        expect(jobApplicationSchema.safeParse(pay(60000, 50000)).success).toBe(false);
        expect(jobApplicationSchema.safeParse(pay(-1, null)).success).toBe(false);
        expect(jobApplicationSchema.safeParse(pay(null, null)).success).toBe(false);
    });

    it("refuses a task that is both completed and cancelled", () => {
        const task = { id: "t1", title: "Follow up", dueOn: "2026-11-27", completedAt: 1, cancelledAt: 2, createdAt: 0 };
        expect(jobApplicationSchema.safeParse({ ...base(), tasks: [task] }).success).toBe(false);
    });

    it("needs interviews to end after they start, in a real time zone, with known contacts", () => {
        const interview = { id: "i1", label: "First round", startsAt: 2000, endsAt: 1000, timeZone: "Europe/Sarajevo", location: null, link: null, contactIds: [], notes: "", outcome: "scheduled" as const, createdAt: 0, updatedAt: 0 };
        expect(jobApplicationSchema.safeParse({ ...base(), interviews: [interview] }).success).toBe(false);
        expect(jobApplicationSchema.safeParse({ ...base(), interviews: [{ ...interview, endsAt: 3000 }] }).success).toBe(true);
        expect(jobApplicationSchema.safeParse({ ...base(), interviews: [{ ...interview, endsAt: null, timeZone: "Mars/Olympus" }] }).success).toBe(false);
        expect(jobApplicationSchema.safeParse({ ...base(), interviews: [{ ...interview, endsAt: null, contactIds: ["nobody"] }] }).success).toBe(false);
    });

    it("never accepts a captured document without a packet, and tells none from unknown", () => {
        const submission = { id: "s1", sentOn: "2026-11-20", sentAt: null, channel: "website" as const, reference: null, cv: { status: "none" as const }, letter: { status: "unknown" as const }, packetId: null, packetSha256: null, recordedAt: 0 };
        expect(jobApplicationSchema.safeParse({ ...base(), submissions: [submission] }).success).toBe(true);
        const captured = { status: "captured" as const, sourceId: "cv-1", capturedTitle: "CV", sourceUpdatedAt: 1, snapshotId: "snap-1" };
        expect(jobApplicationSchema.safeParse({ ...base(), submissions: [{ ...submission, cv: captured }] }).success).toBe(false);
        expect(jobApplicationSchema.safeParse({ ...base(), submissions: [{ ...submission, cv: captured, packetId: "p1", packetSha256: "a".repeat(64) }] }).success).toBe(true);
        expect(jobApplicationSchema.safeParse({ ...base(), submissions: [{ ...submission, packetId: "p1" }] }).success).toBe(false);
    });

    it("refuses duplicate child ids", () => {
        const app = base();
        expect(jobApplicationSchema.safeParse({ ...app, events: [...app.events, app.events[0]] }).success).toBe(false);
    });

    it("round-trips through the portable form with ISO timestamps", () => {
        const app = { ...base(), archivedAt: Date.UTC(2026, 10, 21) };
        const portable = z.encode(portableJobApplicationSchema, app);
        expect(portable.createdAt).toBe("2026-11-20T09:30:00.000Z");
        expect(portable.events[0].recordedAt).toBe("2026-11-20T09:30:00.000Z");
        expect(portable.archivedAt).toBe("2026-11-21T00:00:00.000Z");
        expect(z.decode(portableJobApplicationSchema, JSON.parse(JSON.stringify(portable)))).toEqual(app);
    });

    it("refuses epoch numbers in the portable form", () => {
        expect(portableJobApplicationSchema.safeParse(base()).success).toBe(false);
    });
});
