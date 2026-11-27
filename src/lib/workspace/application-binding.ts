import { liveQuery } from "dexie";
import { db } from "@/lib/db";
import { recordApplicationHistory } from "@/lib/jobs/history";
import { jobApplicationSchema, type JobApplication } from "@/lib/jobs/schema";
import { createApplicationCodec } from "./codecs/application";
import type { DocBinding } from "./cv-binding";

/**
 * What the sync engine needs from a tracked job. The job sheet saves against a revision, so a change
 * written here (which moves the revision on) reaches an open sheet as a conflict it can resolve, never as
 * a silent overwrite of unsaved edits. A restore point is kept before every change from the file.
 */

const codec = createApplicationCodec();

const parse = (row: unknown): JobApplication | null => {
    const parsed = jobApplicationSchema.safeParse(row);
    return parsed.success ? parsed.data : null;
};

export async function createApplicationBinding(docId: string): Promise<DocBinding<JobApplication> | null> {
    let cache = parse(await db.jobApplications.get(docId));
    if (!cache) return null;

    const listeners = new Set<() => void>();
    let ignoreNextEmission = 0;
    let pendingPut: Promise<unknown> = Promise.resolve();

    const subscription = liveQuery(() => db.jobApplications.get(docId)).subscribe({
        next: (row) => {
            const parsed = parse(row);
            if (!parsed) return;
            const previous = cache;
            cache = parsed;
            if (ignoreNextEmission > 0) {
                ignoreNextEmission -= 1;
                return;
            }
            if (previous && !codec.isSameContent(previous, parsed)) for (const listener of listeners) listener();
        },
        error: () => undefined,
    });

    return {
        getDoc: () => cache!,
        applyIncoming(transform) {
            const next = transform(cache!);
            cache = next;
            ignoreNextEmission += 1;
            // Written only over the revision it was built on: an edit saved in the meantime is kept and the engine reads again.
            pendingPut = db.transaction("rw", db.jobApplications, async () => {
                const stored = await db.jobApplications.get(docId);
                if (stored && stored.revision !== next.revision - 1) {
                    ignoreNextEmission = Math.max(0, ignoreNextEmission - 1);
                    for (const listener of listeners) listener();
                    return;
                }
                await db.jobApplications.put(next);
            }).catch(() => undefined);
        },
        snapshot: (application) => recordApplicationHistory(application, "file-sync"),
        flushLocal: async () => {
            await pendingPut;
            const parsed = parse(await db.jobApplications.get(docId));
            if (parsed) cache = parsed;
        },
        onLocalChange(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        dispose() {
            subscription.unsubscribe();
            listeners.clear();
        },
    };
}
