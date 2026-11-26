import { describe, expect, it } from "vitest";
import { archive, changeStage, duplicate, newApplication, normalizeTags, restore, trash, unarchive, updateDetails } from "./operations";
import { jobApplicationSchema } from "./schema";

let counter = 0;
const ctx = (now = 1000) => ({ now, newId: () => `id-${++counter}` });

describe("application operations", () => {
    it("creates a Saved application with only company and role, and one creation event", () => {
        const app = newApplication({ company: "Acme", role: "Designer" }, ctx());
        expect(app).toMatchObject({ stage: "saved", jobUrl: null, workingCvId: null, submissions: [], revision: 1 });
        expect(app.events).toEqual([expect.objectContaining({ type: "created", duplicatedFrom: null, source: "user" })]);
        expect(jobApplicationSchema.safeParse(app).success).toBe(true);
    });

    it("moves to any stage with one event, and never invents a submission", () => {
        const app = newApplication({ company: "Acme", role: "Designer" }, ctx());
        const applied = changeStage(app, "applied", ctx(2000));
        expect(applied.stage).toBe("applied");
        expect(applied.submissions).toEqual([]);
        expect(applied.events.at(-1)).toMatchObject({ type: "stage-changed", from: "saved", to: "applied", recordedAt: 2000 });
        expect(changeStage(applied, "applied", ctx())).toBe(applied);
        expect(changeStage(app, "rejected", ctx(), "2026-03-01").events.at(-1)).toMatchObject({ to: "rejected", occurredOn: "2026-03-01" });
    });

    it("archives and trashes independently of the stage, reversibly", () => {
        const app = changeStage(newApplication({ company: "Acme", role: "Designer" }, ctx()), "interviewing", ctx());
        const archived = archive(app, ctx(3000));
        expect(archived).toMatchObject({ archivedAt: 3000, stage: "interviewing" });
        expect(archive(archived, ctx())).toBe(archived);
        const trashed = trash(archived, ctx(4000));
        const back = unarchive(restore(trashed, ctx(5000)), ctx(6000));
        expect(back).toMatchObject({ archivedAt: null, trashedAt: null, stage: "interviewing" });
        expect(back.events.map((event) => event.type)).toEqual(["created", "stage-changed", "archived", "trashed", "restored", "unarchived"]);
    });

    it("duplicates job details but none of the history", () => {
        const original = {
            ...changeStage(newApplication({ company: "Acme", role: "Designer", tags: ["remote"], workingCvId: "cv-1" }, ctx()), "applied", ctx()),
            submissions: [{ id: "s1", sentOn: "2026-11-20", sentAt: null, channel: "email" as const, reference: null, cv: { status: "none" as const }, letter: { status: "none" as const }, packetId: null, packetSha256: null, recordedAt: 1 }],
        };
        const copy = duplicate(original, ctx(), { keepWorkingDocuments: false });
        expect(copy).toMatchObject({ company: "Acme", role: "Designer", tags: ["remote"], stage: "saved", workingCvId: null, submissions: [], tasks: [], interviews: [] });
        expect(copy.id).not.toBe(original.id);
        expect(copy.events).toEqual([expect.objectContaining({ type: "created", duplicatedFrom: original.id })]);
        expect(duplicate(original, ctx(), { keepWorkingDocuments: true }).workingCvId).toBe("cv-1");
    });

    it("reports no change when an edit leaves the details as they were", () => {
        const app = newApplication({ company: "Acme", role: "Designer", tags: ["Remote"] }, ctx());
        expect(updateDetails(app, { company: "Acme", tags: ["Remote"] })).toBe(app);
        expect(updateDetails(app, { location: "Sarajevo" }).location).toBe("Sarajevo");
    });

    it("folds tags that differ only in case or spacing", () => {
        expect(normalizeTags([" Remote ", "remote", "", "Design"])).toEqual(["Remote", "Design"]);
    });
});
