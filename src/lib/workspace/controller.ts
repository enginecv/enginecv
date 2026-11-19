import { create } from "zustand";
import { db } from "@/lib/db";
import { createDirectoryAdapter, isWorkspaceSupported, pickWorkspaceFolder, type DirectoryAdapter } from "./directory-adapter";
import { createLeader, type Leader } from "./leader";
import { readAppDocuments } from "./apply-stored";
import { analyzeFolder, runSetup, type SetupAnalysis, type SetupOptions, type SetupResult } from "./setup";
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
}

const initial: WorkspaceUiState = { phase: "loading", folderName: null, changeSource: null, hideContact: false, paused: false, isLeader: false, docCount: 0, byState: {}, error: null };

export const useWorkspaceStore = create<WorkspaceUiState>(() => initial);

const set = (patch: Partial<WorkspaceUiState>) => useWorkspaceStore.setState(patch);

let adapter: DirectoryAdapter | null = null;
let leader: Leader | null = null;

export function getAdapter(): DirectoryAdapter | null {
    return adapter;
}

async function refreshCounts() {
    const rows = await db.workspaceDocs.toArray();
    const byState: Partial<Record<DocState, number>> = {};
    for (const row of rows) byState[row.state] = (byState[row.state] ?? 0) + 1;
    set({ docCount: rows.length, byState });
}

function startLeader() {
    leader?.stop();
    leader = createLeader();
    leader.onChange((value) => set({ isLeader: value }));
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
        set({ phase: "connected", folderName: candidate.name, hideContact: input.options.hideContact, paused: false, changeSource: "poll", error: null });
        await refreshCounts();
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
}

/** Stops syncing and forgets the folder. The files stay exactly as they are and every document stays in the app. */
export async function disconnectWorkspace(): Promise<void> {
    leader?.stop();
    leader = null;
    adapter = null;
    await clearWorkspace();
    set({ ...initial, phase: "none", paused: false });
}

/** For tests: forget module state. */
export function resetWorkspaceController(): void {
    leader?.stop();
    leader = null;
    adapter = null;
    useWorkspaceStore.setState(initial);
}
