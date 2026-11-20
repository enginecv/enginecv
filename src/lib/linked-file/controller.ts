import type { LinkedFileRecord } from "@/lib/db";
import { recordResumeHistory } from "@/lib/history";
import { useResumeStore } from "@/lib/store";
import type { Resume } from "@/lib/schema";
import { createHandleAdapter, isLinkingSupported, type FileAdapter } from "@/lib/workspace/fs-access";
import { getLink, setPaused, updateFileName } from "./link-store";
import { createSyncEngine, type StartMode, type SyncEngine } from "./sync-engine";

/**
 * Owns the one running sync engine (the open CV's) and wires it to the store,
 * the history, the database and the page's visibility events. Everything that
 * starts or ends a link goes through here so there is never a second engine.
 */

interface Active {
    resumeId: string;
    engine: SyncEngine;
    adapter: FileAdapter;
    dispose: () => void;
}

let active: Active | null = null;

/** Slices of the CV the file owns; a change in any of them is a content change. */
function contentSlices(resume: Resume): unknown[] {
    return [
        resume.basics, resume.skillGroups, resume.experience, resume.education, resume.courses,
        resume.projects, resume.organisations, resume.certificates, resume.awards, resume.publications,
        resume.references, resume.declaration, resume.languages, resume.interests, resume.customSections,
        resume.settings.contentSections, resume.settings.layout.sectionOrder,
    ];
}

function contentChanged(previous: Resume, next: Resume): boolean {
    const a = contentSlices(previous);
    const b = contentSlices(next);
    return a.some((slice, index) => slice !== b[index]);
}

export function getActiveEngine(resumeId?: string): SyncEngine | null {
    if (!active || (resumeId && active.resumeId !== resumeId)) return null;
    return active.engine;
}

export function getActiveAdapter(resumeId: string): FileAdapter | null {
    return active && active.resumeId === resumeId ? active.adapter : null;
}

export function detachLink(): void {
    if (!active) return;
    active.dispose();
    active = null;
}

export async function attachLink(record: LinkedFileRecord, mode: StartMode): Promise<SyncEngine> {
    detachLink();
    const store = useResumeStore;
    const adapter = createHandleAdapter(record.handle);

    const engine = createSyncEngine({
        adapter,
        getResume: () => store.getState().resume,
        applyIncoming: (transform) => store.getState().applyContentTransform(transform),
        snapshot: (resume) => recordResumeHistory(resume, "file-sync"),
        flushLocal: async () => {
            if (store.getState().isDirty) await store.getState().saveToDb();
        },
        onState: (patch) => store.getState().setLinkedFile(patch),
        onPausedChange: (paused) => void setPaused(record.resumeId, paused),
        onFileName: (name) => {
            if (name !== record.fileName) {
                record = { ...record, fileName: name };
                void updateFileName(record.resumeId, name);
            }
        },
    });

    const unsubscribe = store.subscribe((state, previous) => {
        if (state.activeResumeId !== record.resumeId) return;
        if (state.resume !== previous.resume && contentChanged(previous.resume, state.resume)) engine.notifyLocalChange();
    });
    const onVisibility = () => engine.onVisibilityChange();
    const onFocus = () => engine.onFocus();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);

    active = {
        resumeId: record.resumeId,
        engine,
        adapter,
        dispose: () => {
            engine.stop();
            unsubscribe();
            document.removeEventListener("visibilitychange", onVisibility);
            window.removeEventListener("focus", onFocus);
        },
    };
    store.getState().setLinkedFile({ fileName: adapter.name });
    await engine.start(mode);
    return engine;
}

/**
 * Called when a CV opens: resumes an existing link where the browser still
 * allows it without asking, otherwise shows the "Resume syncing" button.
 */
export async function restoreLink(resumeId: string): Promise<void> {
    const state = useResumeStore.getState();
    if (!isLinkingSupported()) {
        state.setLinkedFile({ status: "unsupported" });
        return;
    }
    const record = await getLink(resumeId);
    if (!record) {
        state.setLinkedFile({ status: "none", fileName: null });
        return;
    }
    state.setLinkedFile({ fileName: record.fileName });
    const adapter = createHandleAdapter(record.handle);
    let permission: "granted" | "prompt" | "denied";
    try {
        permission = await adapter.permissionState();
    } catch {
        useResumeStore.getState().setLinkedFile({ status: "broken" });
        return;
    }
    if (useResumeStore.getState().activeResumeId !== resumeId) return;
    if (permission !== "granted") {
        // "prompt" can be fixed with one click; "denied" needs a relink.
        useResumeStore.getState().setLinkedFile({ status: permission === "prompt" ? "needs-permission" : "broken" });
        return;
    }
    await attachLink(record, record.paused ? "paused" : "reconcile");
}

/** The "Resume syncing" button: must run from a click, because the browser asks then. */
export async function grantAndAttach(resumeId: string): Promise<boolean> {
    const record = await getLink(resumeId);
    if (!record) return false;
    const adapter = createHandleAdapter(record.handle);
    let granted = false;
    try {
        granted = await adapter.ensurePermission(true);
    } catch {
        granted = false;
    }
    if (!granted) {
        useResumeStore.getState().setLinkedFile({ status: "broken" });
        return false;
    }
    await attachLink(record, record.paused ? "paused" : "reconcile");
    return true;
}

