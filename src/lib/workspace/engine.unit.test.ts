import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHandleAdapter } from "@/lib/workspace/fs-access";
import { createQaFullResume } from "@/lib/qa/sample-resumes";
import type { Resume } from "@/lib/schema";
import { createMemoryDirectory } from "../../../test/setup/memory-directory";
import { createCvCodec } from "./codecs/cv";
import { STABILITY_MS, createDocumentSyncEngine, type EngineState, type StartMode } from "./engine";

const codec = createCvCodec();
const options = { hideContact: false };

async function setup(file = "a.cv.json") {
    vi.useFakeTimers();
    const dir = createMemoryDirectory();
    let resume: Resume = { ...createQaFullResume(), id: "cv-1", updatedAt: 0 };
    await dir.writeExternal(file, codec.serialize(resume, options));
    const handle = await dir.root.getFileHandle(file);
    const state: { value: EngineState | null; applied: number; snapshots: Resume[] } = { value: null, applied: 0, snapshots: [] };
    const engine = createDocumentSyncEngine<Resume>({
        adapter: createHandleAdapter(handle as unknown as FileSystemFileHandle),
        codec,
        getDoc: () => resume,
        applyIncoming: (transform) => {
            resume = transform(resume);
            state.applied += 1;
        },
        snapshot: async (doc) => {
            state.snapshots.push(doc);
        },
        onState: (patch) => {
            state.value = { ...(state.value ?? ({} as EngineState)), ...patch } as EngineState;
        },
    });
    const advance = async (ms: number) => vi.advanceTimersByTimeAsync(ms);
    return { dir, file, engine, state, advance, get resume() { return resume; }, set resume(next: Resume) { resume = next; }, start: (mode?: StartMode) => engine.start(mode) };
}

describe("generic document sync engine", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("applies a valid outside edit once, with a restore point first", async () => {
        const t = await setup();
        await t.start("adopt");
        const edited = JSON.parse(codec.serialize(t.resume, options));
        edited.basics.headline = "Edited by an agent";
        await t.dir.writeExternal(t.file, `${JSON.stringify(edited, null, 2)}\n`);
        await t.advance(2000 + STABILITY_MS);
        expect(t.resume.basics.headline).toBe("Edited by an agent");
        expect(t.state.applied).toBe(1);
        expect(t.state.snapshots).toHaveLength(1);
        expect(t.state.snapshots[0].basics.headline).not.toBe("Edited by an agent");
        expect(t.state.value?.status).toBe("in-sync");
        t.engine.stop();
    });

    it("ignores its own write when the file is read back", async () => {
        const t = await setup();
        await t.start("adopt");
        t.resume = { ...t.resume, basics: { ...t.resume.basics, headline: "Typed in the app" }, updatedAt: 5 };
        t.engine.notifyLocalChange();
        await t.advance(1000);
        expect(JSON.parse((await t.dir.readExternal(t.file))!).basics.headline).toBe("Typed in the app");
        const appliedBefore = t.state.applied;
        await t.advance(5000);
        expect(t.state.applied).toBe(appliedBefore);
        t.engine.stop();
    });

    it("never applies a cut-off file and keeps the document", async () => {
        const t = await setup();
        await t.start("adopt");
        const text = codec.serialize(t.resume, options);
        const before = t.resume;
        for (const cut of [10, Math.floor(text.length / 3), Math.floor(text.length / 2), text.length - 20]) {
            await t.dir.writeExternal(t.file, text.slice(0, cut));
            await t.advance(2000 + STABILITY_MS);
            expect(t.resume).toBe(before);
            expect(t.state.value?.status).toBe("error");
        }
        // A corrected file clears the error.
        await t.dir.writeExternal(t.file, text);
        await t.advance(2000 + STABILITY_MS);
        expect(t.state.value?.status).toBe("in-sync");
        t.engine.stop();
    });

    it("does not write over a file in an error state", async () => {
        const t = await setup();
        await t.start("adopt");
        await t.dir.writeExternal(t.file, "{ half a fi");
        await t.advance(2000 + STABILITY_MS);
        t.resume = { ...t.resume, basics: { ...t.resume.basics, headline: "Typed while the file was broken" }, updatedAt: 9 };
        t.engine.notifyLocalChange();
        await t.advance(3000);
        expect(await t.dir.readExternal(t.file)).toBe("{ half a fi");
        t.engine.stop();
    });

    it("reports a busy file and retries with back-off", async () => {
        const t = await setup();
        await t.start("adopt");
        t.dir.failNext(t.file, "write", "NoModificationAllowedError", 1);
        t.resume = { ...t.resume, basics: { ...t.resume.basics, headline: "Wait for me" }, updatedAt: 3 };
        t.engine.notifyLocalChange();
        await t.advance(900);
        expect(t.state.value?.status).toBe("busy");
        await t.advance(2000);
        expect(JSON.parse((await t.dir.readExternal(t.file))!).basics.headline).toBe("Wait for me");
        expect(t.state.value?.status).toBe("in-sync");
        t.engine.stop();
    });
});
