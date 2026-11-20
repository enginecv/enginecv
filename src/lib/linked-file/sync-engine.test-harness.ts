import { vi } from "vitest";
import { FakeDisk, asHandle, type FakeFileHandle } from "../../../test/setup/fake-file-handle";
import { createEmptyResume, type Resume } from "@/lib/schema";
import { createHandleAdapter } from "@/lib/workspace/fs-access";
import { createSyncEngine, type StartMode, type SyncEngine, type SyncEngineDeps } from "./sync-engine";
import { INITIAL_LINKED_FILE_STATE, type LinkedFileState } from "@/lib/workspace/file-state";

export const FILE_NAME = "cv.enginecv.json";

export const doc = (body: Record<string, unknown> = {}) =>
    JSON.stringify({ format: "enginecv.authoring/v1", basics: { name: "Amina" }, ...body }, null, 2);

export interface Harness {
    disk: FakeDisk;
    handle: FakeFileHandle;
    engine: SyncEngine;
    state: LinkedFileState;
    snapshots: Resume[];
    applied: number;
    visible: { value: boolean };
    resume: () => Resume;
    /** What the editor does: change content, then tell the engine. */
    editLocal: (change: (resume: Resume) => Resume) => void;
    setResume: (resume: Resume) => void;
    start: (mode?: StartMode) => Promise<void>;
    advance: (ms: number) => Promise<void>;
}

export function createHarness(initialFile: string, options: { resume?: Resume; deps?: Partial<SyncEngineDeps> } = {}): Harness {
    const disk = new FakeDisk();
    const handle = disk.create(FILE_NAME, initialFile);
    let current = options.resume ?? createEmptyResume();
    current = { ...current, id: current.id || "cv-1", updatedAt: 0 };
    const visible = { value: true };
    const harness = {
        disk,
        handle,
        state: { ...INITIAL_LINKED_FILE_STATE },
        snapshots: [] as Resume[],
        applied: 0,
        visible,
    } as Harness;

    const engine = createSyncEngine({
        adapter: createHandleAdapter(asHandle(handle)),
        getResume: () => current,
        applyIncoming: (transform) => {
            current = transform(current);
            harness.applied += 1;
            // The store subscription calls this after every content change.
            queueMicrotask(() => harness.engine.notifyLocalChange());
        },
        snapshot: async (resume) => {
            harness.snapshots.push(resume);
        },
        onState: (patch) => {
            harness.state = { ...harness.state, ...patch };
        },
        isVisible: () => visible.value,
        ...options.deps,
    });

    harness.engine = engine;
    harness.resume = () => current;
    harness.setResume = (resume) => {
        current = resume;
    };
    harness.editLocal = (change) => {
        current = change(current);
        engine.notifyLocalChange();
    };
    harness.start = (mode) => engine.start(mode);
    harness.advance = async (ms) => {
        await vi.advanceTimersByTimeAsync(ms);
    };
    return harness;
}
