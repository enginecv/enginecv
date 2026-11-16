import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "./db";
import { loadResumeHistory, recordResumeHistory } from "./history";
import { createEmptyResume } from "./schema";

const base = createEmptyResume();
base.id = "cv-h";
const withName = (name: string) => ({ ...base, basics: { ...base.basics, name } });

beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T10:00:00Z"));
    await db.resumeHistory.clear();
});
afterEach(() => vi.useRealTimers());

describe("file-sync snapshots", () => {
    it("keeps the earliest pre-update state of a burst", async () => {
        await recordResumeHistory(withName("before"), "file-sync");
        vi.setSystemTime(Date.now() + 10_000);
        await recordResumeHistory(withName("after first update"), "file-sync");
        const entries = await loadResumeHistory("cv-h");
        expect(entries).toHaveLength(1);
        expect(JSON.parse(entries[0].resumeJson).basics.name).toBe("before");
    });

    it("adds a new snapshot after the rollover window", async () => {
        await recordResumeHistory(withName("one"), "file-sync");
        vi.setSystemTime(Date.now() + 61_000);
        await recordResumeHistory(withName("two"), "file-sync");
        expect(await loadResumeHistory("cv-h")).toHaveLength(2);
    });

    it("never hides typed content: an autosave in between starts a new snapshot", async () => {
        await recordResumeHistory(withName("one"), "file-sync");
        vi.setSystemTime(Date.now() + 5_000);
        await recordResumeHistory(withName("typed"), "autosave");
        vi.setSystemTime(Date.now() + 5_000);
        await recordResumeHistory(withName("typed again"), "file-sync");
        const entries = await loadResumeHistory("cv-h");
        expect(entries.map((entry) => entry.trigger).sort()).toEqual(["autosave", "file-sync", "file-sync"]);
    });
});
