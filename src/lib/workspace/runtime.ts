import type { Notice } from "@/lib/agent/authoring/notices";
import { createCvCodec } from "./codecs/cv";
import { createChangeSource, type ChangeSource } from "./change-source";
import { createCvBinding, type CvBinding } from "./cv-binding";
import type { DirectoryAdapter } from "./directory-adapter";
import { createDocumentSyncEngine, type DocumentSyncEngine, type EngineState } from "./engine";
import type { DocReason, DocState, WorkspaceDocRecord } from "./types";
import { listDocRows, setDocState } from "./workspace-store";

/**
 * The running part of a workspace: one sync engine per included CV, one change source for the whole
 * folder. Only the leader tab runs it. The change source says "something changed", each engine
 * decides whether its own file really did (hash) and applies it with a restore point first.
 */

export interface RuntimeEvents {
    /** An outside change was applied to a document. */
    onApplied?: (docId: string, summary: { added: number; removed: number; changed: number; notices: Notice[] }) => void;
    /** A document's state changed (for the UI and the index). */
    onState?: (docId: string, state: DocState, reason: DocReason | null) => void;
}

export interface RuntimeOptions {
    adapter: DirectoryAdapter;
    root?: FileSystemDirectoryHandle;
    hideContact: () => boolean;
    /** The person paused the workspace: engines start paused. */
    paused?: () => boolean;
    events?: RuntimeEvents;
    /** Tests pass a change source that never polls. */
    createSource?: (onPossibleChange: () => void) => ChangeSource;
    isVisible?: () => boolean;
}

export interface WorkspaceRuntime {
    start(): Promise<void>;
    stop(): void;
    /** Ask every engine to look at its file now. */
    checkNow(): Promise<void>;
    readonly changeSource: ChangeSource | null;
    /** The engines by document id, for tests and the controller. */
    engineFor(docId: string): DocumentSyncEngine | undefined;
}

const cvCodec = createCvCodec();

function docStateOf(state: EngineState): { state: DocState; reason: DocReason | null } {
    switch (state.status) {
        case "error":
            return { state: "blocked", reason: state.error ? { code: state.error.code, line: state.error.line, column: state.error.column } : { code: "invalid-json" } };
        case "busy":
            return { state: "busy", reason: { code: "file-busy" } };
        case "broken":
            return { state: "detached", reason: { code: "file-missing" } };
        case "paused":
            return { state: "paused", reason: null };
        default:
            return { state: "in-sync", reason: null };
    }
}

export function createWorkspaceRuntime(options: RuntimeOptions): WorkspaceRuntime {
    const engines = new Map<string, { engine: DocumentSyncEngine; binding: CvBinding; unsubscribe: () => void; row: WorkspaceDocRecord }>();
    let source: ChangeSource | null = null;
    let running = false;
    const visibility = () => source?.onVisibilityChange();
    const focus = () => source?.nudge();

    async function attach(row: WorkspaceDocRecord) {
        if (row.kind !== "cv" || !row.included || !row.fileName || engines.has(row.docId)) return;
        const binding = await createCvBinding(row.docId);
        if (!binding) return;
        let file;
        try {
            file = await options.adapter.fileAdapter("cvs", row.fileName);
        } catch {
            await setDocState(row.docId, "detached", { code: "file-missing" });
            options.events?.onState?.(row.docId, "detached", { code: "file-missing" });
            binding.dispose();
            return;
        }
        const engine = createDocumentSyncEngine({
            adapter: file,
            codec: cvCodec,
            getDoc: binding.getDoc,
            applyIncoming: binding.applyIncoming,
            snapshot: binding.snapshot,
            flushLocal: binding.flushLocal,
            hideContact: options.hideContact,
            poll: false,
            isVisible: options.isVisible,
            onState: (patch) => {
                if (patch.lastUpdate) {
                    const { added, removed, changed, notices } = patch.lastUpdate;
                    options.events?.onApplied?.(row.docId, { added, removed, changed, notices });
                }
                if (patch.status !== undefined) {
                    const next = docStateOf({ ...({} as EngineState), status: patch.status, error: patch.error ?? null } as EngineState);
                    void setDocState(row.docId, next.state, next.reason);
                    options.events?.onState?.(row.docId, next.state, next.reason);
                }
            },
        });
        const unsubscribe = binding.onLocalChange(() => engine.notifyLocalChange());
        engines.set(row.docId, { engine, binding, unsubscribe, row });
        // The file may have changed while the app was closed: read it, applying a newer file or pausing when the app is newer.
        await engine.start(options.paused?.() ? "paused" : "reconcile");
    }

    return {
        async start() {
            if (running) return;
            running = true;
            const rows = await listDocRows();
            for (const row of rows) await attach(row);
            source = options.createSource
                ? options.createSource(() => void this.checkNow())
                : createChangeSource({ adapter: options.adapter, folders: ["cvs", "letters"], root: options.root, onPossibleChange: () => void this.checkNow(), isVisible: options.isVisible });
            await source.start();
            if (typeof document !== "undefined") document.addEventListener("visibilitychange", visibility);
            if (typeof window !== "undefined") window.addEventListener("focus", focus);
        },
        stop() {
            running = false;
            source?.stop();
            source = null;
            for (const entry of engines.values()) {
                entry.engine.stop();
                entry.unsubscribe();
                entry.binding.dispose();
            }
            engines.clear();
            if (typeof document !== "undefined") document.removeEventListener("visibilitychange", visibility);
            if (typeof window !== "undefined") window.removeEventListener("focus", focus);
        },
        async checkNow() {
            await Promise.all([...engines.values()].map((entry) => entry.engine.checkNow()));
        },
        get changeSource() {
            return source;
        },
        engineFor: (docId) => engines.get(docId)?.engine,
    };
}
