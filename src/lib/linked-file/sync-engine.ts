import type { Resume } from "@/lib/schema";
import { createCvCodec } from "@/lib/workspace/codecs/cv";
import {
    createDocumentSyncEngine,
    type DocumentEngineDeps,
    type DocumentSyncEngine,
    type EngineState,
    type StartMode,
} from "@/lib/workspace/engine";
import type { FileAdapter } from "./fs-access";
import type { LinkedFileState } from "./types";

/**
 * The sync state machine for one linked CV file (feature 089). The algorithm lives in
 * `workspace/engine.ts` and is shared with the workspace folder; this module only fixes the
 * document kind to a CV and keeps the names and file text the per-CV link has always used
 * (no document id in the file).
 */

export {
    BUSY_BACKOFF_MS,
    IDLE_POLL_MS,
    POLL_MS,
    STABILITY_MS,
    WRITE_DEBOUNCE_MS,
    type StartMode,
} from "@/lib/workspace/engine";

export interface SyncEngineDeps {
    adapter: FileAdapter;
    getResume: () => Resume;
    /** Applies a content transform to the open CV (one store update). */
    applyIncoming: (transform: (resume: Resume) => Resume) => void;
    /** Saves the CV as it is now, before a file update replaces content. */
    snapshot: (resume: Resume) => Promise<unknown>;
    /** Makes sure typed content is saved before the file update lands. */
    flushLocal?: () => Promise<void>;
    onState: (patch: Partial<LinkedFileState>) => void;
    /** Tells the host the person paused or resumed (it persists the choice). */
    onPausedChange?: (paused: boolean) => void;
    /** Fires after the adapter's file name may have changed (relink, rename). */
    onFileName?: (name: string) => void;
    now?: () => number;
    isVisible?: () => boolean;
}

export type SyncEngine = DocumentSyncEngine;

const linkCodec = createCvCodec({ includeId: false });

/** What the editor writes: content only (design lives in the app), ids kept, newline at the end. */
export function canonicalText(resume: Resume): string {
    return linkCodec.serialize(resume, { hideContact: false });
}

export function createSyncEngine(deps: SyncEngineDeps): SyncEngine {
    const engineDeps: DocumentEngineDeps<Resume> = {
        adapter: deps.adapter,
        codec: linkCodec,
        getDoc: deps.getResume,
        applyIncoming: deps.applyIncoming,
        snapshot: deps.snapshot,
        flushLocal: deps.flushLocal,
        // An engine for a linked CV only ever reports the codes a linked file can have.
        onState: (patch: Partial<EngineState>) => deps.onState(patch as Partial<LinkedFileState>),
        onPausedChange: deps.onPausedChange,
        onFileName: deps.onFileName,
        now: deps.now,
        isVisible: deps.isVisible,
    };
    return createDocumentSyncEngine(engineDeps);
}
