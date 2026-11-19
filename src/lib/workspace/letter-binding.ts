import { liveQuery } from "dexie";
import { db } from "@/lib/db";
import { recordLetterHistory } from "@/lib/letters/history";
import { letterDocumentSchema, type LetterDocument } from "@/lib/letters/schema";
import { createLetterCodec } from "./codecs/letter";
import type { DocBinding } from "./cv-binding";

/**
 * What the sync engine needs from a letter. The letter editor keeps its text in local state and saves
 * with an optimistic-concurrency check (`saveLetter`), so a change made here by a database write is
 * either followed by the open editor (nothing unsaved) or shown to it as a conflict it can resolve
 * (unsaved typing). Either way both versions are kept; the editor never needs a store round trip.
 */

const codec = createLetterCodec();

const parse = (row: unknown): LetterDocument | null => {
    const parsed = letterDocumentSchema.safeParse(row);
    return parsed.success ? parsed.data : null;
};

export async function createLetterBinding(docId: string): Promise<DocBinding<LetterDocument> | null> {
    let cache = parse(await db.coverLetters.get(docId));
    if (!cache) return null;

    const listeners = new Set<() => void>();
    let ignoreNextEmission = 0;
    let pendingPut: Promise<unknown> = Promise.resolve();

    const subscription = liveQuery(() => db.coverLetters.get(docId)).subscribe({
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
            // Our own write comes back through the live query: it is not a change made in the app.
            ignoreNextEmission += 1;
            pendingPut = db.coverLetters.put(next).catch(() => undefined);
        },
        snapshot: (letter) => recordLetterHistory(letter, "file-sync"),
        flushLocal: async () => {
            await pendingPut;
            const parsed = parse(await db.coverLetters.get(docId));
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
