import type { Notice } from "@/lib/agent/authoring/notices";
import { forEachInSlices } from "./batch";
import { createCvCodec } from "./codecs/cv";
import { createLetterCodec } from "./codecs/letter";
import type { DocumentCodec } from "./codecs/types";
import type { LetterDocument } from "@/lib/letters/schema";
import { createLetterBinding } from "./letter-binding";
import { readFolderSnapshot, reconcile, type IdCache, type Reconciliation } from "./documents";
import type { ConflictCopy } from "./scan";
import { getWorkspace } from "./workspace-store";
import { createChangeSource, type ChangeSource } from "./change-source";
import { db } from "@/lib/db";
import { createCvBinding, type DocBinding } from "./cv-binding";
import type { DirectoryAdapter } from "./directory-adapter";
import { appendLog, clearRefusal, recordActivity as recordActivityRaw, writeRefusal } from "./activity";
import { createDocumentSyncEngine, type DocumentSyncEngine, type EngineState } from "./engine";
import { checkShrink, pendingReviewFor, removedEntryTitles } from "./shrink-guard";
import { importUnclaimed } from "./discover";
import { processRequests } from "./request-processor";
import { MACHINE_DIR } from "./agent-files";
import { EXTENSIONS, safeStem } from "./names";
import { ensureMachineFiles, refreshIndex } from "./machine-files";
import { REQUESTS_DIR } from "./requests";
import type { DocKind, DocReason, DocState, PendingReview, WorkspaceDocRecord } from "./types";
import { listDocRows, patchDocRow as patchDocRowRaw, setDocState as setDocStateRaw } from "./workspace-store";

/**
 * The running part of a workspace: one sync engine per included CV, one change source for the whole
 * folder. Only the leader tab runs it. The change source says "something changed", each engine
 * decides whether its own file really did (hash) and applies it with a restore point first.
 */

export interface RuntimeEvents {
    /** An outside change was applied to a document. */
    onApplied?: (docId: string, summary: { added: number; removed: number; changed: number; notices: Notice[]; agent: string | null; activityId: number | null }) => void;
    /** What needs a look in the folder: unclaimed files, duplicates, sync-tool conflict copies. */
    onAttention?: (attention: { unmatched: Reconciliation["unmatched"]; duplicates: Reconciliation["duplicates"]; conflictCopies: ConflictCopy[] }) => void;
    /** A file nobody claimed became a new document. */
    onImported?: (docId: string, kind: DocKind, agent: string | null) => void;
    /** A change was held for the person to review (it would remove too much). */
    onReview?: (docId: string, agent: string | null) => void;
    /** An export request was answered. */
    onExported?: (info: { docId: string | null; ok: boolean; format: string | null; agent: string | null; file?: string; code?: string }) => void;
    /** A file or folder operation failed in a way that may mean the folder itself is gone or no longer allowed. */
    onFolderProblem?: () => void;
    /** The app's own records could not be saved (storage full or unavailable). */
    onStorageProblem?: () => void;
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
    /** Tests that do not exercise the agent files can switch them off. */
    machineFiles?: boolean;
    /** Tests that do not exercise export requests can switch them off. */
    requests?: boolean;
    /** Tests replace the exporter (it needs a real layout engine for HTML). */
    produceExport?: Parameters<typeof processRequests>[0]["produce"];
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
    /** Writes every included document's file again (the privacy option changed), a few at a time so the page stays responsive. */
    rewriteAll(onProgress?: (done: number, total: number) => void): Promise<void>;
    /** Asks for the index to be rewritten soon (a document came, went or changed). */
    refreshIndexSoon(): void;
    /** Re-reads CV titles (a CV was renamed), so letter files keep an accurate hint. */
    refreshTitles(): Promise<void>;
    /** Rebuilds one document's engine from its row (after a relink or a resolved conflict). */
    reload(docId: string): Promise<void>;
    /** The engines by document id, for tests and the controller. */
    engineFor(docId: string): DocumentSyncEngine | undefined;
}

const cvCodec = createCvCodec();

/** The first words of the paragraphs a letter would lose, for the review dialog (shown in the app only). */
function removedParagraphPreviews(before: LetterDocument, after: LetterDocument, max = 10): string[] {
    const kept = new Set(after.paragraphs.map((paragraph) => paragraph.id));
    return before.paragraphs.filter((paragraph) => !kept.has(paragraph.id)).slice(0, max).map((paragraph) => paragraph.markdown.trim().slice(0, 60) || "…");
}

function docStateOf(state: EngineState): { state: DocState; reason: DocReason | null } {
    switch (state.status) {
        case "review":
            return { state: "review", reason: { code: "shrink-guard" } };
        case "error":
            return { state: "blocked", reason: state.error ? { code: state.error.code, line: state.error.line, column: state.error.column, detail: state.error.detail } : { code: "invalid-json" } };
        case "busy":
            return { state: "busy", reason: { code: state.storageFull ? "storage-full" : "file-busy" } };
        case "broken":
            return { state: "detached", reason: { code: "file-missing" } };
        case "paused":
            return { state: "paused", reason: null };
        default:
            return { state: "in-sync", reason: null };
    }
}

export function createWorkspaceRuntime(options: RuntimeOptions): WorkspaceRuntime {
    // The app's own records can fail to save (storage full or unavailable): say so once and carry on, the documents are untouched.
    const guarded = <A extends unknown[], R>(work: (...args: A) => Promise<R>) => (...args: A): Promise<R | undefined> => work(...args).catch(() => { options.events?.onStorageProblem?.(); return undefined; });
    const recordActivity = guarded(recordActivityRaw);
    const patchDocRow = guarded(patchDocRowRaw);
    const setDocState = guarded(setDocStateRaw);
    // CV titles, written beside a letter's CV id as a hint for humans.
    const cvTitles = new Map<string, string>();
    const letterCodec = createLetterCodec({ cvTitle: (id) => cvTitles.get(id) });
    const refreshCvTitles = async () => {
        cvTitles.clear();
        for (const row of await db.resumes.toArray()) if (row.id) cvTitles.set(row.id, row.meta?.title || row.basics?.name || "");
    };
    const engines = new Map<string, { engine: DocumentSyncEngine; binding: Pick<DocBinding<unknown>, "dispose">; unsubscribe: () => void; row: WorkspaceDocRecord }>();
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

    /**
     * A file renamed outside the app renames the document too: the title becomes the new file stem, so the
     * app and the folder agree. Returns the title now in use (to remember as the one the file name came from),
     * or null when nothing changed. A sent letter keeps its title.
     */
    async function adoptTitleFromFileName(docId: string, kind: "cv" | "letter", fileName: string): Promise<string | null> {
        const suffix = EXTENSIONS[kind];
        const stem = (fileName.toLowerCase().endsWith(suffix) ? fileName.slice(0, -suffix.length) : fileName).trim();
        if (!stem) return null;
        try {
            if (kind === "cv") {
                const row = await db.resumes.get(docId);
                if (!row) return null;
                if (safeStem(row.meta?.title || row.basics?.name || "") === stem) return null;
                await db.resumes.put({ ...row, meta: { ...row.meta, title: stem }, updatedAt: Math.max(Date.now(), (row.updatedAt ?? 0) + 1) });
                return stem;
            }
            const row = await db.coverLetters.get(docId);
            if (!row || row.status !== "draft") return null;
            if (safeStem(row.title || "") === stem) return null;
            await db.coverLetters.put({ ...row, title: stem, updatedAt: Math.max(Date.now(), (row.updatedAt ?? 0) + 1) });
            return stem;
        } catch {
            return null;
        }
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
            const followedTitle = await adoptTitleFromFileName(rename.docId, rename.kind, rename.to);
            await patchDocRow(rename.docId, { fileName: rename.to, state: "in-sync", reason: null, ...(followedTitle !== null ? { fileTitle: followedTitle } : {}) });
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
            await writeRefusal(options.adapter, { docId, file: row ? `${row.kind === "cv" ? "cvs" : "letters"}/${row.fileName}` : null, code: "file-missing" }).catch(() => undefined);
            await appendLog(options.adapter, { at: Date.now(), doc: docId, outcome: "info", code: "file-missing" }).catch(() => undefined);
        }
        for (const duplicate of result.duplicates) {
            const row = rows.find((candidate) => candidate.docId === duplicate.docId);
            if (row?.state === "blocked" && row.reason?.code === "duplicate-id") continue;
            detach(duplicate.docId);
            await setDocState(duplicate.docId, "blocked", { code: "duplicate-id", detail: String(duplicate.files.length) });
            options.events?.onState?.(duplicate.docId, "blocked", { code: "duplicate-id" });
            await recordActivity({ docId: duplicate.docId, kind: "refused", code: "duplicate-id", detail: String(duplicate.files.length) });
            await writeRefusal(options.adapter, { docId: duplicate.docId, file: duplicate.files[0] ? `${duplicate.kind === "cv" ? "cvs" : "letters"}/${duplicate.files[0]}` : null, code: "duplicate-id", detail: `${duplicate.files.length} files` }).catch(() => undefined);
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
        // Complete files nobody claims become new documents (an agent made a new CV or letter).
        let leftOver = result.unmatched;
        if (result.unmatched.some((file) => file.valid)) {
            const found = await importUnclaimed(options.adapter, result.unmatched, { hideContact: options.hideContact() });
            for (const item of found.imported) {
                await recordActivity({ docId: item.docId, kind: "accepted", code: "applied", detail: "new document from file" });
                await appendLog(options.adapter, { at: Date.now(), doc: item.docId, file: `${item.kind === "cv" ? "cvs" : "letters"}/${item.fileName}`, outcome: "accepted", detail: "new document" }).catch(() => undefined);
                const fresh = (await listDocRows()).find((candidate) => candidate.docId === item.docId);
                if (fresh) await attach(fresh);
                options.events?.onImported?.(item.docId, item.kind, item.agent);
            }
            const importedNames = new Set(found.imported.map((item) => item.fileName));
            leftOver = result.unmatched.filter((file) => !importedNames.has(file.fileName));
        }
        options.events?.onAttention?.({ unmatched: leftOver, duplicates: result.duplicates, conflictCopies: snapshot.conflictCopies });
    }

    /** A draft that names a CV the app does not have keeps working; it is marked so the person can pick a CV. */
    async function markUnknownCv(docId: string) {
        const letter = await db.coverLetters.get(docId);
        const missing = !!letter && letter.status === "draft" && !!letter.cvId && (await db.resumes.where("id").equals(letter.cvId).count()) === 0;
        await patchDocRow(docId, { reason: missing ? { code: "unknown-cv" } : null });
    }

    // The index and the instruction files stay current: made again when missing, the index rewritten a moment after anything changed.
    const INDEX_DELAY_MS = 2000;
    const ENSURE_EVERY_MS = 10_000;
    let indexTimer: ReturnType<typeof setTimeout> | null = null;
    let lastEnsure = 0;
    async function refreshMachineFiles(options2: { ensure: boolean; index: boolean }) {
        if (!running || options.machineFiles === false) return;
        try {
            if (options2.ensure) {
                lastEnsure = Date.now();
                await ensureMachineFiles(options.adapter, { hideContact: options.hideContact() });
            }
            if (options2.index) await refreshIndex(options.adapter);
        } catch {
            // A folder problem is the controller's to report; the next change tries again.
        }
    }
    /** Cheap and only now and then: a deleted instruction file or index comes back even when nothing else changes. */
    async function keepMachineFilesFresh() {
        if (!running || options.machineFiles === false) return;
        lastEnsure = Date.now();
        const indexMissing = !(await options.adapter.exists(MACHINE_DIR, "index.json").catch(() => true));
        void refreshMachineFiles({ ensure: true, index: indexMissing });
    }
    let housekeepingTimer: ReturnType<typeof setInterval> | null = null;

    function refreshIndexSoon() {
        if (!running || options.machineFiles === false) return;
        if (indexTimer) clearTimeout(indexTimer);
        indexTimer = setTimeout(() => {
            indexTimer = null;
            void refreshMachineFiles({ ensure: false, index: true });
        }, INDEX_DELAY_MS);
    }

    let handlingRequests = false;
    /** Export requests an agent left behind; one pass at a time, never while the runtime is stopping. */
    async function handleRequests() {
        if (!running || handlingRequests || options.requests === false) return;
        handlingRequests = true;
        try {
            await processRequests({ adapter: options.adapter, produce: options.produceExport, onAnswered: (info) => options.events?.onExported?.(info) });
        } catch {
            // A folder problem is the controller's to report; an unhandled request is picked up on the next pass.
        } finally {
            handlingRequests = false;
        }
    }

    async function attach(row: WorkspaceDocRecord) {
        if (!row.included || !row.fileName || engines.has(row.docId)) return;
        if (row.kind === "cv") {
            const binding = await createCvBinding(row.docId);
            if (!binding) return;
            await attachEngine(row, "cvs", cvCodec, binding, (before, incoming) => {
                const verdict = checkShrink(cvCodec.entryCount(before), cvCodec.entryCount(incoming));
                return verdict.triggered ? pendingReviewFor(verdict, removedEntryTitles(before, incoming).titles, Date.now()) : null;
            });
            return;
        }
        const binding = await createLetterBinding(row.docId);
        if (!binding) return;
        await attachEngine(row, "letters", letterCodec, binding, (before, incoming) => {
            // A letter file can leave paragraphs out (then they stay), so judge what the letter would hold after the apply.
            const after = letterCodec.apply(before, incoming, { hideContact: options.hideContact() });
            const verdict = checkShrink(letterCodec.entryCount(before), letterCodec.entryCount(after));
            return verdict.triggered ? pendingReviewFor(verdict, removedParagraphPreviews(before, after), Date.now()) : null;
        });
    }

    async function attachEngine<TDoc>(row: WorkspaceDocRecord, folder: "cvs" | "letters", codec: DocumentCodec<TDoc>, binding: DocBinding<TDoc>, guard: (before: TDoc, incoming: TDoc) => PendingReview | null) {
        let file;
        try {
            file = await options.adapter.fileAdapter(folder, row.fileName!);
        } catch {
            await setDocState(row.docId, "detached", { code: "file-missing" });
            options.events?.onState?.(row.docId, "detached", { code: "file-missing" });
            binding.dispose();
            return;
        }
        let lastRestoreId: number | null = null;
        let knownHash: string | null = row.lastHash;
        const engine = createDocumentSyncEngine<TDoc>({
            adapter: file,
            codec,
            getDoc: binding.getDoc,
            applyIncoming: binding.applyIncoming,
            snapshot: async (doc) => {
                const id = await binding.snapshot(doc);
                lastRestoreId = typeof id === "number" ? id : null;
                return id;
            },
            knownFileHash: () => knownHash,
            guard,
            flushLocal: binding.flushLocal,
            hideContact: options.hideContact,
            poll: false,
            isVisible: options.isVisible,
            onState: (patch) => {
                const fileLabel = `${folder}/${row.fileName}`;
                if (patch.lastUpdate) {
                    const { added, removed, changed, notices } = patch.lastUpdate;
                    const agent = patch.lastUpdate.agent ?? null;
                    const detail = `+${added}/-${removed}/~${changed}`;
                    // Told after the activity row exists, so a notification's Undo can point at it.
                    void (async () => {
                        const activityId = await recordActivity({ docId: row.docId, kind: "accepted", code: "applied", detail, restoreId: lastRestoreId, restoreKind: row.kind }).catch(() => null);
                        options.events?.onApplied?.(row.docId, { added, removed, changed, notices, agent, activityId: typeof activityId === "number" ? activityId : null });
                    })();
                    void appendLog(options.adapter, { at: Date.now(), doc: row.docId, file: fileLabel, outcome: "accepted", detail }).catch(() => undefined);
                }
                if (patch.syncedHash) {
                    knownHash = patch.syncedHash;
                    void patchDocRow(row.docId, { lastHash: patch.syncedHash });
                }
                if (patch.status === "in-sync" || patch.lastUpdate) refreshIndexSoon();
                if (patch.status === undefined) return;
                if (patch.status === "broken") options.events?.onFolderProblem?.();
                const next = docStateOf({ ...({} as EngineState), status: patch.status, error: patch.error ?? null, storageFull: patch.storageFull } as EngineState);
                void setDocState(row.docId, next.state, next.reason);
                refreshIndexSoon();
                if (row.kind === "letter" && next.state === "in-sync") void markUnknownCv(row.docId);
                options.events?.onState?.(row.docId, next.state, next.reason);
                if (next.state === "review" && patch.review) {
                    void patchDocRow(row.docId, { pendingReview: patch.review });
                    options.events?.onReview?.(row.docId, patch.review.agent ?? null);
                    void recordActivity({ docId: row.docId, kind: "review", code: "shrink-guard", detail: `${patch.review.keptCount} of ${patch.review.previousCount} kept` });
                    void appendLog(options.adapter, { at: Date.now(), doc: row.docId, file: fileLabel, outcome: "review", code: "shrink-guard" }).catch(() => undefined);
                    void writeRefusal(options.adapter, { docId: row.docId, file: fileLabel, code: "shrink-guard", detail: `${patch.review.keptCount} of ${patch.review.previousCount} kept` }).catch(() => undefined);
                } else if (next.state === "blocked" && next.reason) {
                    void recordActivity({ docId: row.docId, kind: "refused", code: next.reason.code, detail: next.reason.detail });
                    void appendLog(options.adapter, { at: Date.now(), doc: row.docId, file: fileLabel, outcome: "refused", code: next.reason.code, line: next.reason.line, column: next.reason.column, detail: next.reason.detail }).catch(() => undefined);
                    void writeRefusal(options.adapter, { docId: row.docId, file: fileLabel, code: next.reason.code, line: next.reason.line, column: next.reason.column, detail: next.reason.detail }).catch(() => undefined);
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
            await refreshCvTitles().catch(() => undefined);
            await refreshMachineFiles({ ensure: true, index: true });
            const rows = await listDocRows();
            for (const row of rows) await attach(row);
            await reconcileFolder().catch(() => undefined);
            source = options.createSource
                ? options.createSource(() => void this.checkNow())
                : createChangeSource({ adapter: options.adapter, folders: ["cvs", "letters", REQUESTS_DIR], root: options.root, onPossibleChange: () => void this.checkNow(), isVisible: options.isVisible });
            await source.start();
            // The folder scan only watches the document folders, so a deleted AGENTS.md or index is noticed by this timer.
            housekeepingTimer = setInterval(() => {
                if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
                void keepMachineFilesFresh();
            }, ENSURE_EVERY_MS);
            if (typeof document !== "undefined") document.addEventListener("visibilitychange", visibility);
            if (typeof window !== "undefined") window.addEventListener("focus", focus);
        },
        stop() {
            running = false;
            if (indexTimer) clearTimeout(indexTimer);
            indexTimer = null;
            if (housekeepingTimer) clearInterval(housekeepingTimer);
            housekeepingTimer = null;
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
            await handleRequests();
            if (Date.now() - lastEnsure > ENSURE_EVERY_MS) {
                await keepMachineFilesFresh();
            }
        },
        get changeSource() {
            return source;
        },
        rewriteAll: async (onProgress) => {
            const all = [...engines.values()];
            let done = 0;
            onProgress?.(0, all.length);
            await forEachInSlices(all, async (entry) => {
                await entry.engine.rewrite().catch(() => undefined);
                done += 1;
                onProgress?.(done, all.length);
            });
        },
        refreshIndexSoon,
        refreshTitles: refreshCvTitles,
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
