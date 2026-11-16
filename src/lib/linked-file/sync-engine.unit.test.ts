import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyResume } from "@/lib/schema";
import { IDLE_POLL_MS, canonicalText, POLL_MS, STABILITY_MS, WRITE_DEBOUNCE_MS } from "./sync-engine";
import { doc, createHarness } from "./sync-engine.test-harness";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const withProject = (title: string) => doc({ projects: [{ name: title }] });

describe("read path", () => {
    it("applies an outside edit once, with a snapshot, and reports the counts", async () => {
        const h = createHarness(doc());
        await h.start("adopt");
        h.disk.externalWrite("cv.enginecv.json", withProject("Weather Bot"));
        await h.advance(POLL_MS + STABILITY_MS + 50);
        expect(h.applied).toBe(1);
        expect(h.snapshots).toHaveLength(1);
        expect(h.snapshots[0].projects).toHaveLength(0);
        expect(h.resume().projects[0].name).toBe("Weather Bot");
        expect(h.state.status).toBe("in-sync");
        expect(h.state.lastUpdate).toMatchObject({ added: 1, removed: 0 });
        await h.advance(10_000);
        expect(h.applied).toBe(1);
    });

    it("applies a burst of two quick writes once, after the file is stable", async () => {
        const h = createHarness(doc());
        await h.start("adopt");
        await h.advance(POLL_MS - 100);
        h.disk.externalWrite("cv.enginecv.json", withProject("first"));
        await h.advance(150);
        await h.advance(STABILITY_MS / 2);
        h.disk.externalWrite("cv.enginecv.json", withProject("second"));
        await h.advance(10_000);
        expect(h.applied).toBe(1);
        expect(h.resume().projects[0].name).toBe("second");
    });

    it("ignores a newline-only change", async () => {
        const h = createHarness(doc());
        await h.start("adopt");
        h.disk.externalWrite("cv.enginecv.json", `${doc()}\n\n`);
        await h.advance(POLL_MS + STABILITY_MS + 50);
        expect(h.applied).toBe(0);
        expect(h.snapshots).toHaveLength(0);
    });

    it("detects an edit that keeps the timestamp but changes the size", async () => {
        const h = createHarness(doc());
        await h.start("adopt");
        h.disk.externalWrite("cv.enginecv.json", withProject("longer content"), { keepStamp: true });
        await h.advance(POLL_MS + STABILITY_MS + 50);
        expect(h.resume().projects[0]?.name).toBe("longer content");
    });

    it("does not touch the CV's design, id or photo", async () => {
        const base = (await import("@/lib/schema")).createEmptyResume();
        base.id = "keep-me";
        base.settings.colors.accent = "#abcdef";
        base.basics.photo = "data:image/png;base64,AAA";
        const h = createHarness(doc(), { resume: base });
        await h.start("adopt");
        h.disk.externalWrite("cv.enginecv.json", doc({ design: { accent: "#000000" }, projects: [{ name: "x" }] }));
        await h.advance(POLL_MS + STABILITY_MS + 50);
        expect(h.resume().id).toBe("keep-me");
        expect(h.resume().settings.colors.accent).toBe("#abcdef");
        expect(h.resume().basics.photo).toBe("data:image/png;base64,AAA");
    });
});

describe("write path", () => {
    it("debounces and coalesces editor changes into one write", async () => {
        const h = createHarness(doc());
        await h.start("adopt");
        const before = h.handle.writes;
        h.editLocal((r) => ({ ...r, basics: { ...r.basics, name: "A" } }));
        await h.advance(300);
        h.editLocal((r) => ({ ...r, basics: { ...r.basics, name: "Am" } }));
        await h.advance(300);
        h.editLocal((r) => ({ ...r, basics: { ...r.basics, name: "Ami" } }));
        await h.advance(WRITE_DEBOUNCE_MS + 50);
        expect(h.handle.writes).toBe(before + 1);
        expect(JSON.parse(h.disk.read("cv.enginecv.json")!).basics.name).toBe("Ami");
        expect(h.disk.read("cv.enginecv.json")!.endsWith("\n")).toBe(true);
    });

    it("does not re-apply its own write", async () => {
        const h = createHarness(doc());
        await h.start("adopt");
        h.editLocal((r) => ({ ...r, basics: { ...r.basics, name: "Own" } }));
        await h.advance(WRITE_DEBOUNCE_MS + 50);
        const applied = h.applied;
        await h.advance(10_000);
        expect(h.applied).toBe(applied);
        expect(h.snapshots).toHaveLength(0);
    });

    it("cancels the write and reads first when the file changed while it waited", async () => {
        const h = createHarness(doc());
        await h.start("adopt");
        h.editLocal((r) => ({ ...r, basics: { ...r.basics, name: "Typed" } }));
        h.disk.externalWrite("cv.enginecv.json", withProject("from agent"));
        await h.advance(WRITE_DEBOUNCE_MS + 50);
        expect(h.resume().projects[0]?.name).toBe("from agent");
        // The typed state is kept in the snapshot taken before the update.
        expect(h.snapshots[0].basics.name).toBe("Typed");
    });

    it("does not write for a design-only change", async () => {
        const base = { ...createEmptyResume(), id: "cv-1", updatedAt: 0 };
        const h = createHarness(canonicalText(base), { resume: base });
        await h.start("adopt");
        const before = h.handle.writes;
        h.editLocal((r) => ({ ...r, settings: { ...r.settings, colors: { ...r.settings.colors, accent: "#123456" } } }));
        await h.advance(WRITE_DEBOUNCE_MS + 50);
        expect(h.handle.writes).toBe(before);
    });
});

describe("polling", () => {
    it("stops while the tab is hidden and checks at once when it is visible again", async () => {
        const h = createHarness(doc());
        await h.start("adopt");
        h.visible.value = false;
        h.engine.onVisibilityChange();
        h.disk.externalWrite("cv.enginecv.json", withProject("while hidden"));
        await h.advance(30_000);
        expect(h.applied).toBe(0);
        h.visible.value = true;
        h.engine.onVisibilityChange();
        await h.advance(STABILITY_MS + 50);
        expect(h.resume().projects[0]?.name).toBe("while hidden");
    });

    it("backs off to the idle interval after a minute and resets on a change", async () => {
        const h = createHarness(doc());
        const stat = vi.spyOn(h.handle, "getFile");
        await h.start("adopt");
        await h.advance(61_000);
        stat.mockClear();
        await h.advance(10_000);
        const idleCalls = stat.mock.calls.length;
        expect(idleCalls).toBeLessThanOrEqual(Math.ceil(10_000 / IDLE_POLL_MS) + 1);
        h.engine.onFocus();
        stat.mockClear();
        await h.advance(10_000);
        expect(stat.mock.calls.length).toBeGreaterThan(idleCalls);
    });

    it("skips a tick while an operation is still running", async () => {
        const h = createHarness(doc());
        await h.start("adopt");
        let release!: () => void;
        const gate = new Promise<void>((resolve) => { release = resolve; });
        const original = h.handle.getFile.bind(h.handle);
        let reads = 0;
        h.handle.getFile = async () => {
            reads += 1;
            if (reads === 1) await gate;
            return original();
        };
        void h.engine.checkNow();
        await h.advance(POLL_MS * 4);
        const during = reads;
        release();
        await h.advance(50);
        expect(during).toBe(1);
    });
});
