import type { Notice } from "@/lib/agent/authoring/notices";
import { createCvCodec } from "./codecs/cv";
import { readFolderSnapshot, reconcile, type IdCache, type Reconciliation } from "./documents";
import type { ConflictCopy } from "./scan";
import { getWorkspace } from "./workspace-store";
import { createChangeSource, type ChangeSource } from "./change-source";
import { createCvBinding, type CvBinding } from "./cv-binding";
import type { DirectoryAdapter } from "./directory-adapter";
import { appendLog, clearRefusal, recordActivity, writeRefusal } from "./activity";
import { createDocumentSyncEngine, type DocumentSyncEngine, type EngineState } from "./engine";
import { checkShrink, pendingReviewFor, removedEntryTitles } from "./shrink-guard";
import type { DocReason, DocState, WorkspaceDocRecord } from "./types";
import { listDocRows, patchDocRow, setDocState } from "./workspace-store";

/**
 * The running part of a workspace: one sync engine per included CV, one change source for the whole
 * folder. Only the leader tab runs it. The change source says "something changed", each engine
 * decides whether its own file really did (hash) and applies it with a restore point first.
 */

export interface RuntimeEvents {
    /** An outside change was applied to a document. */
    onApplied?: (docId: string, summary: { added: number; removed: number; changed: number; notices: Notice[] }) => void;
    /** What needs a look in the folder: unclaimed files, duplicates, sync-tool conflict copies. */
    onAttention?: (attention: { unmatched: Reconciliation["unmatched"]; duplicates: Reconciliation["duplicates"]; conflictCopies: ConflictCopy[] }) => void;
    /** A file or folder operation failed in a way that may mean the folder itself is gone or no longer allowed. */
    onFolderProblem?: () => void;
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
    /** The person confirmed a held change: apply it (a restore point is taken first). */
    applyHeld(docId: string): Promise<void>;
    /** The person confirmed keeping the app's version: it is written over the file. */
    keepMine(docId: string): Promise<void>;
    /** Rebuilds one document's engine from its row (after a relink or a resolved conflict). */
    reload(docId: string): Promise<void>;
    /** The engines by document id, for tests and the controller. */
    engineFor(docId: string): DocumentSyncEngine | undefined;
}

const cvCodec = createCvCodec();

function docStateOf(state: EngineState): { state: DocState; reason: DocReason | null } {
    switch (state.status) {
        case "review":
            return { state: "review", reason: { code: "shrink-guard" } };
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
    const idCache: IdCache = new Map();
    const visibility = () => source?.onVisibilityChange();
    const focus = () => source?.nudge();

    function detach(docId: string) {
        const entry = engines.get(docId);
        if (!entry) return;
        entry.engine.stop();
        entry.unsubscribe();
        entry.binding.dispose();
        engines.delete(docId);
    }

    /** Compares the folder with the documents: follows renames, detaches missing files, flags duplicates, reports strays. */
    async function reconcileFolder() {
        const workspace = await getWorkspace();
        const ignored = new Set((workspace?.ignoredFiles ?? []).map((name) => name.toLowerCase()));
        const snapshot = await readFolderSnapshot(options.adapter, idCache, ignored);
        const rows = await listDocRows();
        const result = reconcile(rows, snapshot);

        for (const rename of result.renames) {
            detach(rename.docId);
            await patchDocRow(rename.docId, { fileName: rename.to, state: "in-sync", reason: null });
            await appendLog(options.adapter, { at: Date.now(), doc: rename.docId, file: `${rename.kind === "cv" ? "cvs" : "letters"}/${rename.to}`, outcome: "info", detail: "renamed" }).catch(() => undefined);
            const fresh = (await listDocRows()).find((candidate) => candidate.docId === rename.docId);
            if (fresh) await attach(fresh);
        }
        for (const docId of result.detached) {
            const row = rows.find((candidate) => candidate.docId === docId);
            if (row?.state === "detached") continue;
            detach(docId);
            await setDocState(docId, "detached", { code: "file-missing" });
            options.events?.onState?.(docId, "detached", { code: "file-missing" });
            await recordActivity({ docId, kind: "refused", code: "file-missing" });
            await appendLog(options.adapter, { at: Date.now(), doc: docId, outcome: "info", code: "file-missing" }).catch(() => undefined);
        }
        for (const duplicate of result.duplicates) {
            const row = rows.find((candidate) => candidate.docId === duplicate.docId);
            if (row?.state === "blocked" && row.reason?.code === "duplicate-id") continue;
            detach(duplicate.docId);
            await setDocState(duplicate.docId, "blocked", { code: "duplicate-id", detail: String(duplicate.files.length) });
            options.events?.onState?.(duplicate.docId, "blocked", { code: "duplicate-id" });
            await recordActivity({ docId: duplicate.docId, kind: "refused", code: "duplicate-id", detail: String(duplicate.files.length) });
            await appendLog(options.adapter, { at: Date.now(), doc: duplicate.docId, outcome: "refused", code: "duplicate-id" }).catch(() => undefined);
        }
        // A file that came back, or a duplicate that was resolved, brings its document back to life.
        const stillBad = new Set([...result.detached, ...result.duplicates.map((entry) => entry.docId)]);
        for (const row of rows) {
            const wasStopped = row.state === "detached" || (row.state === "blocked" && row.reason?.code === "duplicate-id");
            if (wasStopped && row.included && row.fileName && !stillBad.has(row.docId) && !engines.has(row.docId)) {
                await setDocState(row.docId, "in-sync", null);
                const fresh = (await listDocRows()).find((candidate) => candidate.docId === row.docId);
                if (fresh) await attach(fresh);
            }
        }
        options.events?.onAttention?.({ unmatched: result.unmatched, duplicates: result.duplicates, conflictCopies: snapshot.conflictCopies });
    }

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
        let lastRestoreId: number | null = null;
        let knownHash: string | null = row.lastHash;
        const engine = createDocumentSyncEngine({
            adapter: file,
            codec: cvCodec,
            getDoc: binding.getDoc,
            applyIncoming: binding.applyIncoming,
            snapshot: async (doc) => {
                const id = await binding.snapshot(doc);
                lastRestoreId = typeof id === "number" ? id : null;
                return id;
            },
            knownFileHash: () => knownHash,
            guard: (before, incoming) => {
                const verdict = checkShrink(cvCodec.entryCount(before), cvCodec.entryCount(incoming));
                return verdict.triggered ? pendingReviewFor(verdict, removedEntryTitles(before, incoming).titles, Date.now()) : null;
            },
            flushLocal: binding.flushLocal,
            hideContact: options.hideContact,
            poll: false,
            isVisible: options.isVisible,
            onState: (patch) => {
                const fileLabel = `cvs/${row.fileName}`;
                if (patch.lastUpdate) {
                    const { added, removed, changed, notices } = patch.lastUpdate;
                    options.events?.onApplied?.(row.docId, { added, removed, changed, notices });
                    const detail = `+${added}/-${removed}/~${changed}`;
                    void recordActivity({ docId: row.docId, kind: "accepted", code: "applied", detail, restoreId: lastRestoreId, restoreKind: "cv" });
                    void appendLog(options.adapter, { at: Date.now(), doc: row.docId, file: fileLabel, outcome: "accepted", detail }).catch(() => undefined);
                }
                if (patch.syncedHash) {
                    knownHash = patch.syncedHash;
                    void patchDocRow(row.docId, { lastHash: patch.syncedHash });
                }
                if (patch.status === undefined) return;
                if (patch.status === "broken") options.events?.onFolderProblem?.();
                const next = docStateOf({ ...({} as EngineState), status: patch.status, error: patch.error ?? null } as EngineState);
                void setDocState(row.docId, next.state, next.reason);
                options.events?.onState?.(row.docId, next.state, next.reason);
                if (next.state === "review" && patch.review) {
                    void patchDocRow(row.docId, { pendingReview: patch.review });
                    void recordActivity({ docId: row.docId, kind: "review", code: "shrink-guard", detail: `${patch.review.keptCount} of ${patch.review.previousCount} kept` });
                    void appendLog(options.adapter, { at: Date.now(), doc: row.docId, file: fileLabel, outcome: "review", code: "shrink-guard" }).catch(() => undefined);
                    void writeRefusal(options.adapter, { docId: row.docId, file: fileLabel, code: "shrink-guard" }).catch(() => undefined);
                } else if (next.state === "blocked" && next.reason) {
                    void recordActivity({ docId: row.docId, kind: "refused", code: next.reason.code });
                    void appendLog(options.adapter, { at: Date.now(), doc: row.docId, file: fileLabel, outcome: "refused", code: next.reason.code, line: next.reason.line, column: next.reason.column }).catch(() => undefined);
                    void writeRefusal(options.adapter, { docId: row.docId, file: fileLabel, code: next.reason.code, line: next.reason.line, column: next.reason.column }).catch(() => undefined);
                } else if (next.state === "in-sync") {
                    void patchDocRow(row.docId, { pendingReview: null });
                    void clearRefusal(options.adapter, row.docId).catch(() => undefined);
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
            await reconcileFolder().catch(() => undefined);
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
            try {
                await reconcileFolder();
            } catch {
                options.events?.onFolderProblem?.();
            }
            await Promise.all([...engines.values()].map((entry) => entry.engine.checkNow()));
        },
        get changeSource() {
            return source;
        },
        reload: async (docId) => {
            detach(docId);
            const fresh = (await listDocRows()).find((candidate) => candidate.docId === docId);
            if (fresh) await attach(fresh);
        },
        applyHeld: async (docId) => engines.get(docId)?.engine.applyHeld(),
        keepMine: async (docId) => engines.get(docId)?.engine.keepMine(),
        engineFor: (docId) => engines.get(docId)?.engine,
    };
}
