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
import type { ChangeSourceKind, DocState } from "./types";
import { clearWorkspace, getWorkspace, updateWorkspace } from "./workspace-store";

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
    attention: { unmatched: Reconciliation["unmatched"]; duplicates: Reconciliation["duplicates"]; conflictCopies: ConflictCopy[] };
}

const initial: WorkspaceUiState = { phase: "loading", folderName: null, changeSource: null, hideContact: false, paused: false, isLeader: false, docCount: 0, byState: {}, error: null, attention: { unmatched: [], duplicates: [], conflictCopies: [] } };

export const useWorkspaceStore = create<WorkspaceUiState>(() => initial);

const set = (patch: Partial<WorkspaceUiState>) => useWorkspaceStore.setState(patch);

let adapter: DirectoryAdapter | null = null;
let leader: Leader | null = null;
let runtime: WorkspaceRuntime | null = null;
let rootHandle: FileSystemDirectoryHandle | undefined;

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
            events: { onState: () => void refreshCounts(), onAttention: (attention) => set({ attention }) },
        });
        void runtime.start().then(() => set({ changeSource: runtime?.changeSource?.kind ?? "poll" })).catch(() => undefined);
    } else if (!wanted && runtime) {
        runtime.stop();
        runtime = null;
    }
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
