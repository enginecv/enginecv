import { liveQuery, type Subscription } from "dexie";
import { create } from "zustand";
import { db } from "@/lib/db";
import { createDirectoryAdapter, isWorkspaceSupported, pickWorkspaceFolder, type DirectoryAdapter } from "./directory-adapter";
import { createLeader, type Leader } from "./leader";
import { createWorkspaceRuntime, type WorkspaceRuntime } from "./runtime";
import { readAppDocuments } from "./apply-stored";
import { assignFileNames, analyzeFolder, runSetup, type SetupAnalysis, type SetupOptions, type SetupResult } from "./setup";
import { createCvCodec } from "./codecs/cv";
import { recreateFile, relinkDocument, type Reconciliation } from "./documents";
import type { ConflictCopy } from "./scan";
import { MACHINE_DIR } from "./agent-files";
import { safeStem } from "./names";
import { parseCv } from "@/lib/letters/store";
import type { ChangeSourceKind, DocState, WorkspaceDocRecord } from "./types";
import { listLinkedCvs, moveLinkedCvs } from "./migrate-links";
import { BROWSER_TOOLS_EVENT, syncBrowserTools } from "./browser-tools";
import { excludeDocument, includeDocument, mirrorDocuments, retireDocument, type IncludeChoice, type RetireChoice } from "./lifecycle";
import { clearWorkspace, getWorkspace, putDocRow, setDocState, updateWorkspace } from "./workspace-store";

/**
 * The workspace's lifecycle in this browser: is there a folder, do we have permission, are we the tab
 * that does the work. The UI reads `useWorkspaceStore`; everything that changes the workspace goes
 * through the functions here. Disconnecting never touches the folder or the documents.
 */

export type WorkspacePhase = "unsupported" | "loading" | "none" | "connecting" | "connected" | "needs-permission" | "broken";

export interface WorkspaceUiState {
    phase: WorkspacePhase;
    folderName: string | null;
    changeSource: ChangeSourceKind | null;
    hideContact: boolean;
    paused: boolean;
    isLeader: boolean;
    docCount: number;
    /** Documents by state, for the panel summary and chips. */
    byState: Partial<Record<DocState, number>>;
    /** A message key for the last problem the panel should show, or null. */
    error: string | null;
    /** What needs a look in the folder: unclaimed files, duplicates, sync-tool copies. */
    /** Set while every file is being rewritten after the privacy option changed. */
    /** The app could not save its own workspace records (storage full or unavailable). */
    storageProblem: boolean;
    rewriting: { done: number; total: number } | null;
    attention: { unmatched: Reconciliation["unmatched"]; duplicates: Reconciliation["duplicates"]; conflictCopies: ConflictCopy[] };
}

const initial: WorkspaceUiState = { phase: "loading", folderName: null, changeSource: null, hideContact: false, paused: false, isLeader: false, docCount: 0, byState: {}, error: null, storageProblem: false, rewriting: null, attention: { unmatched: [], duplicates: [], conflictCopies: [] } };

export const useWorkspaceStore = create<WorkspaceUiState>(() => initial);

const set = (patch: Partial<WorkspaceUiState>) => useWorkspaceStore.setState(patch);

let adapter: DirectoryAdapter | null = null;
let leader: Leader | null = null;
let runtime: WorkspaceRuntime | null = null;
let rootHandle: FileSystemDirectoryHandle | undefined;
let mirrorSubscription: Subscription | null = null;
let mirrorTimer: ReturnType<typeof setTimeout> | null = null;
let mirrorRunning = false;
const MIRROR_DEBOUNCE_MS = 600;

export function getAdapter(): DirectoryAdapter | null {
    return adapter;
}

async function refreshCounts() {
    const rows = await db.workspaceDocs.toArray();
    const byState: Partial<Record<DocState, number>> = {};
    for (const row of rows) byState[row.state] = (byState[row.state] ?? 0) + 1;
    set({ docCount: rows.length, byState });
}

/** The engines run only while this tab leads, a folder is connected with permission, and syncing is not paused. */
function syncRuntime() {
    const state = useWorkspaceStore.getState();
    const wanted = state.phase === "connected" && state.isLeader && !state.paused && adapter !== null;
    if (wanted && !runtime && adapter) {
        runtime = createWorkspaceRuntime({
            adapter,
            root: rootHandle,
            hideContact: () => useWorkspaceStore.getState().hideContact,
            paused: () => useWorkspaceStore.getState().paused,
            events: { onState: () => void refreshCounts(), onAttention: (attention) => set({ attention }), onImported: () => void refreshCounts(), onFolderProblem: () => void verifyFolder(), onStorageProblem: () => set({ storageProblem: true }) },
        });
        void runtime.start().then(() => set({ changeSource: runtime?.changeSource?.kind ?? "poll" })).catch(() => undefined);
        startMirroring();
    } else if (!wanted && runtime) {
        runtime.stop();
        runtime = null;
        stopMirroring();
    }
}

let verifying = false;

/**
 * Something failed that may mean the folder is no longer ours: the browser took the permission back
 * (one button restores it) or the folder is gone (choose it again). Editing in the app never stops.
 */
export async function verifyFolder(): Promise<void> {
    if (!adapter || verifying || useWorkspaceStore.getState().phase !== "connected") return;
    verifying = true;
    try {
        const stopAll = async (state: "needs-permission" | "broken", reason: "permission" | "folder-missing") => {
            runtime?.stop();
            runtime = null;
            stopMirroring();
            for (const row of await db.workspaceDocs.toArray()) if (row.included) await setDocState(row.docId, state === "broken" ? "broken" : "needs-permission", { code: reason });
            set(state === "broken" ? { phase: "broken", error: "workspace.reason.folder-missing" } : { phase: "needs-permission" });
            await refreshCounts();
        };
        try {
            if ((await adapter.permissionState()) !== "granted") return await stopAll("needs-permission", "permission");
            await adapter.listFolders("");
        } catch (error) {
            const code = (error as { code?: string }).code;
            await stopAll(code === "permission" ? "needs-permission" : "broken", code === "permission" ? "permission" : "folder-missing");
        }
    } finally {
        verifying = false;
    }
}

/** A signature of the documents' names, so the live query fires when one is added, removed or renamed (not on every keystroke in a body). */
async function documentSignature(): Promise<string> {
    const cvs = (await db.resumes.toArray()).map((row) => `${row.id}|${row.meta?.title ?? ""}|${row.basics?.name ?? ""}`);
    const letters = (await db.coverLetters.toArray()).map((row) => `${row.id}|${row.title ?? ""}|${row.company ?? ""}|${row.role ?? ""}`);
    return [...cvs, ...letters].sort().join("\n");
}

/** Mirrors new, renamed and deleted documents into the folder, then restarts the engines that moved. */
export async function mirrorNow(): Promise<void> {
    if (!adapter || !runtime || mirrorRunning) return;
    mirrorRunning = true;
    try {
        const result = await mirrorDocuments(adapter, { hideContact: useWorkspaceStore.getState().hideContact });
        await runtime?.refreshTitles().catch(() => undefined);
        runtime?.refreshIndexSoon();
        for (const docId of [...result.created, ...result.renamed]) await runtime?.reload(docId);
        await refreshCounts();
    } catch {
        // A folder problem is reported by the engines and the controller; the next change tries again.
    } finally {
        mirrorRunning = false;
    }
}

function startMirroring() {
    stopMirroring();
    mirrorSubscription = liveQuery(documentSignature).subscribe({
        next: () => {
            if (mirrorTimer) clearTimeout(mirrorTimer);
            mirrorTimer = setTimeout(() => void mirrorNow(), MIRROR_DEBOUNCE_MS);
        },
        error: () => undefined,
    });
}

function stopMirroring() {
    mirrorSubscription?.unsubscribe();
    mirrorSubscription = null;
    if (mirrorTimer) clearTimeout(mirrorTimer);
    mirrorTimer = null;
}

export function getRuntime(): WorkspaceRuntime | null {
    return runtime;
}

function startLeader() {
    leader?.stop();
    leader = createLeader();
    leader.onChange((value) => {
        set({ isLeader: value });
        syncRuntime();
    });
    leader.start();
}

/** Called once when the app starts in a browser: restores a connected workspace, or says why there is none. */
export async function initWorkspace(): Promise<void> {
    startBrowserTools();
    if (!isWorkspaceSupported()) {
        set({ ...initial, phase: "unsupported" });
        return;
    }
    const row = await getWorkspace();
    if (!row) {
        set({ ...initial, phase: "none" });
        return;
    }
    adapter = createDirectoryAdapter(row.handle);
    rootHandle = row.handle;
    set({ folderName: row.folderName, hideContact: row.hideContact, paused: row.paused, changeSource: row.changeSource });
    await refreshCounts();
    try {
        const state = await adapter.permissionState();
        if (state === "granted") {
            set({ phase: "connected", error: null });
            startLeader();
        } else {
            set({ phase: "needs-permission" });
        }
    } catch {
        set({ phase: "broken", error: "workspace.reason.folder-missing" });
    }
}

/** Asks the person for a folder and looks at it. Returns null when they close the picker. */
export async function chooseFolder(options: SetupOptions): Promise<{ handle: FileSystemDirectoryHandle; analysis: SetupAnalysis } | null> {
    const handle = await pickWorkspaceFolder();
    if (!handle) return null;
    return { handle, analysis: await analyzeFolderHandle(handle, options) };
}

/** Looks at a folder and proposes what to do, without writing anything. */
export async function analyzeFolderHandle(handle: FileSystemDirectoryHandle, options: SetupOptions): Promise<SetupAnalysis> {
    const candidate = createDirectoryAdapter(handle);
    return analyzeFolder(candidate, await readAppDocuments(), options);
}

/** Writes the confirmed plan into the folder and starts the workspace. */
export async function connectFolder(input: { handle: FileSystemDirectoryHandle; analysis: SetupAnalysis; options: SetupOptions }): Promise<SetupResult> {
    set({ phase: "connecting", error: null });
    try {
        const candidate = createDirectoryAdapter(input.handle);
        const docs = await readAppDocuments();
        const result = await runSetup({ adapter: candidate, handle: input.handle, plan: input.analysis.plan, appDocs: input.analysis.appDocs, docs, options: input.options });
        adapter = candidate;
        rootHandle = input.handle;
        await refreshCounts();
        set({ phase: "connected", folderName: candidate.name, hideContact: input.options.hideContact, paused: false, changeSource: "poll", error: null });
        startLeader();
        return result;
    } catch (error) {
        set({ phase: "none", error: "workspace.panel.connectFailed" });
        throw error;
    }
}

/** The browser asked again for permission: one button restores the connection. */
export async function resumePermission(): Promise<boolean> {
    if (!adapter) return false;
    try {
        const granted = await adapter.ensurePermission(true);
        if (granted) {
            set({ phase: "connected", error: null });
            startLeader();
        }
        return granted;
    } catch {
        set({ phase: "broken", error: "workspace.reason.folder-missing" });
        return false;
    }
}

export async function setPaused(paused: boolean): Promise<void> {
    await updateWorkspace({ paused });
    set({ paused });
    syncRuntime();
}

/** Stops syncing and forgets the folder. The files stay exactly as they are and every document stays in the app. */
export async function disconnectWorkspace(): Promise<void> {
    runtime?.stop();
    runtime = null;
    stopMirroring();
    leader?.stop();
    leader = null;
    adapter = null;
    await clearWorkspace();
    set({ ...initial, phase: "none", paused: false });
}

/** For tests: forget module state. */
export function resetWorkspaceController(): void {
    runtime?.stop();
    runtime = null;
    stopMirroring();
    rootHandle = undefined;
    leader?.stop();
    leader = null;
    adapter = null;
    useWorkspaceStore.setState(initial);
}

// -- decisions the person makes about documents ------------------------------------------------------

/** Applies a change that was held for review (a restore point is taken first). */
export async function applyHeldChange(docId: string): Promise<void> {
    await runtime?.applyHeld(docId);
    await refreshCounts();
}

/** Keeps EngineCV's version and writes it over the file; the file's current text is copied to .enginecv/conflicts first. */
export async function keepAppVersion(docId: string): Promise<void> {
    const row = await db.workspaceDocs.get(docId);
    if (adapter && row?.fileName) {
        const folder = row.kind === "cv" ? "cvs" : "letters";
        const existing = await adapter.readText(folder, row.fileName);
        if (existing !== null) await adapter.writeText(`${MACHINE_DIR}/conflicts`, `${safeStem(row.fileName)}.${Date.now()}.bak`, existing);
    }
    await runtime?.keepMine(docId);
    await refreshCounts();
}

async function ignoreNames(names: readonly string[]): Promise<void> {
    const row = await getWorkspace();
    const next = [...new Set([...(row?.ignoredFiles ?? []), ...names])];
    await updateWorkspace({ ignoredFiles: next });
}

/** Stops reporting a file (a sync-tool copy or a stray). The file is not touched. */
export async function ignoreFile(fileName: string): Promise<void> {
    await ignoreNames([fileName]);
    await runtime?.checkNow();
}

/** Two files claim one document: keep `keepFile`, ignore the others, and bring the document back. */
export async function chooseDuplicate(docId: string, keepFile: string, otherFiles: readonly string[]): Promise<void> {
    const row = await db.workspaceDocs.get(docId);
    if (!adapter || !row) return;
    await ignoreNames(otherFiles);
    await relinkDocument(docId, keepFile, adapter, row.kind);
    await runtime?.reload(docId);
    await runtime?.checkNow();
}

/** Points a document without a file at an existing one. */
export async function relinkDocumentTo(docId: string, fileName: string): Promise<void> {
    const row = await db.workspaceDocs.get(docId);
    if (!adapter || !row) return;
    await relinkDocument(docId, fileName, adapter, row.kind);
    await runtime?.reload(docId);
    await refreshCounts();
}

/** Writes EngineCV's version of a detached CV to a file again. */
export async function recreateDocumentFile(docId: string): Promise<void> {
    const row = await db.workspaceDocs.get(docId);
    const stored = await db.resumes.get(docId);
    const cv = stored ? parseCv(stored) : null;
    if (!adapter || !row || !cv || row.kind !== "cv") return;
    const taken = (await adapter.listFiles("cvs")).map((file) => file.name);
    const names = assignFileNames([cv], [], new Map([[docId, null]]), taken);
    const fileName = names.get(docId)!;
    await recreateFile(docId, fileName, createCvCodec().serialize(cv, { hideContact: useWorkspaceStore.getState().hideContact }), "cv", adapter);
    await runtime?.reload(docId);
    await refreshCounts();
}

// -- document lifecycle from the app --------------------------------------------------------------

/** Called before a document is deleted: what happens to its file (the person chose). */
export async function retireBeforeDelete(docId: string, choice: RetireChoice): Promise<void> {
    if (!adapter) return;
    await retireDocument(adapter, docId, choice);
    await runtime?.reload(docId);
    await refreshCounts();
}

/**
 * Undo of a delete that kept the file: puts the document's row back and stops ignoring its file, so the
 * document is mirrored to the same file again. Does nothing without a connected folder.
 */
export async function restoreRetiredDocument(row: WorkspaceDocRecord): Promise<void> {
    if (!adapter) return;
    await putDocRow(row);
    if (row.fileName) {
        const workspace = await getWorkspace();
        const rest = (workspace?.ignoredFiles ?? []).filter((name) => name !== row.fileName);
        await updateWorkspace({ ignoredFiles: rest });
    }
    await runtime?.reload(row.docId);
    await refreshCounts();
}

/** Leaves a document out of the folder; its file is left alone. */
export async function excludeFromWorkspace(docId: string): Promise<void> {
    await excludeDocument(docId);
    await runtime?.reload(docId);
    await refreshCounts();
}

/** Brings a document back, using the same choice the first sync offers for a file that already exists. */
export async function includeInWorkspace(docId: string, choice: IncludeChoice): Promise<boolean> {
    if (!adapter) return false;
    const result = await includeDocument(adapter, docId, choice, { hideContact: useWorkspaceStore.getState().hideContact });
    await runtime?.reload(docId);
    await refreshCounts();
    return result.ok;
}

/** True when the document has a file in a connected workspace folder. */
export async function documentHasWorkspaceFile(docId: string): Promise<boolean> {
    if (useWorkspaceStore.getState().phase !== "connected") return false;
    const row = await db.workspaceDocs.get(docId);
    return !!row && row.included && !!row.fileName;
}

/**
 * Turns "leave contact details out of the files" on or off and rewrites every included file. Each file is
 * replaced whole (never half-written), so an interruption leaves every file either old or new, and the
 * documents in the app are never touched.
 */
export async function setHideContact(hide: boolean): Promise<void> {
    if (useWorkspaceStore.getState().hideContact === hide) return;
    await updateWorkspace({ hideContact: hide });
    set({ hideContact: hide, rewriting: { done: 0, total: 0 } });
    try {
        await runtime?.rewriteAll((done, total) => set({ rewriting: { done, total } }));
    } finally {
        set({ rewriting: null });
        await refreshCounts();
    }
}

/** Moves CVs that are still linked to a single file into the folder. The old files are left untouched; any that could not be moved stay linked. */
export async function moveLinkedIntoWorkspace(resumeIds?: readonly string[]): Promise<{ moved: number; failed: number }> {
    if (!adapter) return { moved: 0, failed: 0 };
    const ids = resumeIds ?? (await listLinkedCvs()).map((cv) => cv.resumeId);
    const result = await moveLinkedCvs(adapter, ids, { hideContact: useWorkspaceStore.getState().hideContact });
    for (const id of result.moved) await runtime?.reload(id);
    runtime?.refreshIndexSoon();
    await refreshCounts();
    return { moved: result.moved.length, failed: result.failed.length };
}

let browserToolsListening = false;

/** Registers the optional in-browser assistant tools when supported and turned on (see browser-tools.ts). Harmless anywhere else. */
export function startBrowserTools(): void {
    const sync = () => void syncBrowserTools({ getAdapter: () => adapter });
    sync();
    if (!browserToolsListening && typeof window !== "undefined") {
        browserToolsListening = true;
        window.addEventListener(BROWSER_TOOLS_EVENT, sync);
    }
}
