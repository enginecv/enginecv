import { liveQuery } from "dexie";
import { db } from "@/lib/db";
import { recordResumeHistory } from "@/lib/history";
import { parseCv } from "@/lib/letters/store";
import type { Resume } from "@/lib/schema";
import { useResumeStore } from "@/lib/store";

/**
 * What the sync engine needs from a CV, whether or not it is open in the editor. An open CV is read
 * and changed through the editor's store (so the editor shows the change in place and its own
 * autosave cannot overwrite it); a closed CV is read from a cache that follows the database and
 * changed with a database write.
 */
export interface DocBinding<TDoc> {
    getDoc(): TDoc;
    applyIncoming(transform: (doc: TDoc) => TDoc): void;
    snapshot(doc: TDoc): Promise<unknown>;
    flushLocal(): Promise<void>;
    /** Calls `listener` when the CV changes in the app (typing in the editor or a write from elsewhere). */
    onLocalChange(listener: () => void): () => void;
    dispose(): void;
}

export type CvBinding = DocBinding<Resume>;

/** Slices of the CV a file owns; a change in any of them is a content change. */
function contentSlices(resume: Resume): unknown[] {
    return [
        resume.basics, resume.skillGroups, resume.experience, resume.education, resume.courses,
        resume.projects, resume.organisations, resume.certificates, resume.awards, resume.publications,
        resume.references, resume.declaration, resume.languages, resume.interests, resume.customSections,
        resume.settings.contentSections, resume.settings.layout.sectionOrder,
    ];
}

const contentChanged = (a: Resume, b: Resume) => contentSlices(a).some((slice, index) => slice !== contentSlices(b)[index]);

export async function createCvBinding(docId: string): Promise<CvBinding | null> {
    const first = await db.resumes.get(docId);
    let cache = first ? parseCv(first) : null;
    if (!cache) return null;

    const listeners = new Set<() => void>();
    let ignoreNextEmission = 0;
    /** Our last database write, so a refresh never reads a state older than something we just wrote. */
    let pendingPut: Promise<unknown> = Promise.resolve();

    // The cache follows the database, so a write from another tab or a restore reaches the engine.
    const subscription = liveQuery(() => db.resumes.get(docId)).subscribe({
        next: (row) => {
            const parsed = row ? parseCv(row) : null;
            if (!parsed) return;
            const previous = cache;
            cache = parsed;
            if (ignoreNextEmission > 0) {
                ignoreNextEmission -= 1;
                return;
            }
            if (!isOpen() && previous && contentChanged(previous, parsed)) for (const listener of listeners) listener();
        },
        error: () => undefined,
    });

    const isOpen = () => useResumeStore.getState().activeResumeId === docId;
    const unsubscribeStore = useResumeStore.subscribe((state, previous) => {
        if (state.activeResumeId !== docId) return;
        if (state.resume !== previous.resume && contentChanged(previous.resume, state.resume)) for (const listener of listeners) listener();
    });

    return {
        getDoc: () => (isOpen() ? useResumeStore.getState().resume : cache!),
        applyIncoming(transform) {
            if (isOpen()) {
                useResumeStore.getState().applyContentTransform(transform);
                return;
            }
            const next = transform(cache!);
            cache = next;
            // Our own write comes back through the live query: it is not a change made in the app.
            ignoreNextEmission += 1;
            pendingPut = db.resumes.put(next).catch(() => undefined);
        },
        snapshot: (resume) => recordResumeHistory(resume, "file-sync"),
        flushLocal: async () => {
            const state = useResumeStore.getState();
            if (isOpen()) {
                if (state.isDirty) await state.saveToDb();
                return;
            }
            // A closed CV: take what the database holds now, which can be newer than the live-query cache by a moment (another tab's edit).
            await pendingPut;
            const row = await db.resumes.get(docId);
            const parsed = row ? parseCv(row) : null;
            if (parsed) cache = parsed;
        },
        onLocalChange(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        dispose() {
            subscription.unsubscribe();
            unsubscribeStore();
            listeners.clear();
        },
    };
}
