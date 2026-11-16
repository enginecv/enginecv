import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyResume } from "@/lib/schema";
import { BUSY_BACKOFF_MS, POLL_MS, STABILITY_MS, WRITE_DEBOUNCE_MS, canonicalText } from "./sync-engine";
import { createHarness, doc, FILE_NAME } from "./sync-engine.test-harness";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const SETTLE = POLL_MS + STABILITY_MS + 50;

async function startWith(initial = doc()) {
    const h = createHarness(initial);
    await h.start("adopt");
    return h;
}

describe("invalid files never change the CV or get overwritten", () => {
    it.each([
        ["empty", "   ", undefined],
        ["too-large", `{"format":"enginecv.authoring/v1","summary":"${"x".repeat(210 * 1024)}"}`, undefined],
        ["no-document", "just some words", undefined],
        ["no-document", "{}", undefined],
        ["invalid-json", '{\n  "format": "enginecv.authoring/v1",\n  "basics": { "name": }\n}', { line: 3, column: 23 }],
        ["full-export", JSON.stringify(createEmptyResume()), undefined],
        ["newer-version", doc({ format: "enginecv.authoring/v2", projects: [{ name: "x" }] }), undefined],
    ])("%s", async (code, content, position) => {
        const h = await startWith();
        const before = h.resume();
        const writesBefore = h.handle.writes;
        h.disk.externalWrite(FILE_NAME, content);
        await h.advance(SETTLE);
        expect(h.state.status).toBe("error");
        expect(h.state.error?.code).toBe(code);
        if (position) expect(h.state.error).toMatchObject(position);
        expect(h.resume()).toBe(before);
        expect(h.snapshots).toHaveLength(0);
        // An editor change while the file is in error must not overwrite the file.
        h.editLocal((r) => ({ ...r, basics: { ...r.basics, name: "Typed" } }));
        await h.advance(WRITE_DEBOUNCE_MS + 100);
        expect(h.handle.writes).toBe(writesBefore);
        expect(h.disk.read(FILE_NAME)).toBe(content);
    });

    it("recovers on the next valid read", async () => {
        const h = await startWith();
        h.disk.externalWrite(FILE_NAME, "{ broken");
        await h.advance(SETTLE);
        expect(h.state.status).toBe("error");
        h.disk.externalWrite(FILE_NAME, doc({ projects: [{ name: "Fixed" }] }));
        await h.advance(SETTLE);
        expect(h.state.status).toBe("in-sync");
        expect(h.state.error).toBeNull();
        expect(h.resume().projects[0].name).toBe("Fixed");
    });

    it("applies the valid parts of a partly valid document and reports notices", async () => {
        const h = await startWith();
        h.disk.externalWrite(FILE_NAME, doc({
            projects: [{ name: "Good" }],
            experience: [{ position: "Dev", start: "not a date", end: "2021" }],
            "unknown thing": ["a", "b"],
        }));
        await h.advance(SETTLE);
        expect(h.state.status).toBe("in-sync");
        expect(h.resume().projects[0].name).toBe("Good");
        expect(h.state.lastUpdate?.notices.length).toBeGreaterThan(0);
    });
});

describe("busy and vanished files", () => {
    it("goes busy on a lock, retries with backoff and writes once released", async () => {
        const h = await startWith(canonicalText({ ...createEmptyResume(), id: "cv-1" }));
        h.handle.locked = true;
        h.editLocal((r) => ({ ...r, basics: { ...r.basics, name: "Locked out" } }));
        await h.advance(WRITE_DEBOUNCE_MS + 50);
        expect(h.state.status).toBe("busy");
        expect(h.state.error).toBeNull();
        h.handle.locked = false;
        await h.advance(BUSY_BACKOFF_MS[0] + WRITE_DEBOUNCE_MS + 100);
        expect(JSON.parse(h.disk.read(FILE_NAME)!).basics.name).toBe("Locked out");
        expect(h.state.status).toBe("in-sync");
    });

    it("stops retrying after the last delay and keeps the CV untouched", async () => {
        const h = await startWith(canonicalText({ ...createEmptyResume(), id: "cv-1" }));
        h.handle.locked = true;
        h.editLocal((r) => ({ ...r, basics: { ...r.basics, name: "Never" } }));
        await h.advance(WRITE_DEBOUNCE_MS + 30_000);
        expect(h.state.status).toBe("busy");
        expect(h.resume().basics.name).toBe("Never");
    });

    it("is broken when the file vanishes or is renamed outside the app", async () => {
        const h = await startWith();
        const before = h.resume();
        h.disk.externalRename(FILE_NAME, "other-name.json");
        await h.advance(SETTLE);
        expect(h.state.status).toBe("broken");
        expect(h.resume()).toBe(before);
        const writes = h.handle.writes;
        h.editLocal((r) => ({ ...r, basics: { ...r.basics, name: "x" } }));
        await h.advance(WRITE_DEBOUNCE_MS + 100);
        expect(h.handle.writes).toBe(writes);
    });

    it("is broken when permission is lost", async () => {
        const h = await startWith();
        h.handle.permission = "denied";
        h.disk.externalWrite(FILE_NAME, doc({ projects: [{ name: "x" }] }));
        await h.advance(SETTLE);
        expect(h.state.status).toBe("broken");
    });
});

describe("pause", () => {
    it("holds both directions", async () => {
        const h = await startWith();
        await h.engine.pause();
        expect(h.state.status).toBe("paused");
        const writes = h.handle.writes;
        h.disk.externalWrite(FILE_NAME, doc({ projects: [{ name: "x" }] }));
        h.editLocal((r) => ({ ...r, basics: { ...r.basics, name: "typed" } }));
        await h.advance(10_000);
        expect(h.applied).toBe(0);
        expect(h.handle.writes).toBe(writes);
    });

    it.each([
        ["nothing changed", false, false],
        ["only the file changed", true, false],
        ["only the CV changed", false, true],
        ["both changed", true, true],
    ])("on resume reports: %s", async (_label, fileChanged, cvChanged) => {
        const h = await startWith(canonicalText({ ...createEmptyResume(), id: "cv-1" }));
        await h.engine.pause();
        if (fileChanged) h.disk.externalWrite(FILE_NAME, doc({ projects: [{ name: "from file" }] }));
        if (cvChanged) h.setResume({ ...h.resume(), basics: { ...h.resume().basics, name: "from cv" } });
        await h.engine.resume();
        if (!fileChanged && !cvChanged) {
            expect(h.state.status).toBe("in-sync");
            expect(h.state.divergence).toBeNull();
        } else {
            expect(h.state.status).toBe("paused");
            expect(h.state.divergence).toEqual({ fileChanged, cvChanged });
            expect(h.applied).toBe(0);
        }
    });

    it("lets the person pick the file or the CV", async () => {
        const base = canonicalText({ ...createEmptyResume(), id: "cv-1" });
        const h = await startWith(base);
        await h.engine.pause();
        h.disk.externalWrite(FILE_NAME, doc({ projects: [{ name: "from file" }] }));
        h.setResume({ ...h.resume(), basics: { ...h.resume().basics, name: "from cv" } });
        await h.engine.resume();
        await h.engine.resolveDivergence("file");
        expect(h.resume().projects[0].name).toBe("from file");
        expect(h.snapshots).toHaveLength(1);
        expect(h.snapshots[0].basics.name).toBe("from cv");
        expect(h.state.status).toBe("in-sync");

        const h2 = await startWith(base);
        await h2.engine.pause();
        h2.disk.externalWrite(FILE_NAME, doc({ projects: [{ name: "from file" }] }));
        h2.setResume({ ...h2.resume(), basics: { ...h2.resume().basics, name: "from cv" } });
        await h2.engine.resume();
        await h2.engine.resolveDivergence("cv");
        expect(JSON.parse(h2.disk.read(FILE_NAME)!).basics.name).toBe("from cv");
        expect(h2.state.status).toBe("in-sync");
    });
});
