import { createCvCodec } from "./codecs/cv";
import type { DirectoryAdapter } from "./directory-adapter";
import { nameKey } from "./names";
import { classifyListing, type ConflictCopy } from "./scan";
import type { DocKind, WorkspaceDocRecord } from "./types";
import { patchDocRow } from "./workspace-store";
import { parseLetterText } from "@/lib/letters/file-format";
import { hashText } from "@/lib/workspace/hash";

/**
 * Who is who in the folder. A document is identified by the `id` inside its file, not by the file
 * name, so a rename outside the app is followed, a deleted file leaves the document detached, two
 * files claiming one document are flagged instead of applied, and files nobody claims are listed.
 * `reconcile` is pure; `readFolderSnapshot` reads only what changed; the resolution functions do what
 * the person chose in the conflicts dialog.
 */

export interface SnapshotFile {
    kind: DocKind;
    name: string;
    /** The document id written in the file, or null when it has none or does not parse. */
    id: string | null;
    /** The file holds a complete, usable document (it parsed), whether or not it names an id. */
    valid: boolean;
}

export interface FolderSnapshot {
    files: SnapshotFile[];
    conflictCopies: ConflictCopy[];
    skipped: string[];
    /** Document files over the size limit: present, but not read (the engine reports `too-large`). */
    tooLarge?: string[];
}

const cvCodec = createCvCodec();

/** Stamp and id cache, so a scan reads a file again only when its timestamp or size moved. */
export type IdCache = Map<string, { stamp: string; id: string | null; valid: boolean }>;

export async function readFolderSnapshot(adapter: DirectoryAdapter, cache: IdCache, ignored: ReadonlySet<string> = new Set()): Promise<FolderSnapshot> {
    const scan = classifyListing({ cvs: await adapter.listFiles("cvs"), letters: await adapter.listFiles("letters") });
    const files: SnapshotFile[] = [];
    for (const doc of scan.documents) {
        if (ignored.has(nameKey(doc.name))) continue;
        const key = `${doc.kind}:${nameKey(doc.name)}`;
        const stamp = `${doc.lastModified}:${doc.size}`;
        let cached = cache.get(key);
        if (!cached || cached.stamp !== stamp) {
            const text = await adapter.readText(doc.kind === "cv" ? "cvs" : "letters", doc.name);
            let id: string | null = null;
            let valid = false;
            if (text !== null) {
                if (doc.kind === "cv") {
                    const parsed = cvCodec.parse(text, { now: 0, hideContact: false });
                    id = parsed.ok ? parsed.id : null;
                    valid = parsed.ok;
                } else {
                    const parsed = parseLetterText(text);
                    id = parsed.ok ? parsed.id : null;
                    valid = parsed.ok;
                }
            }
            cached = { stamp, id, valid };
            cache.set(key, cached);
        }
        files.push({ kind: doc.kind, name: doc.name, id: cached.id, valid: cached.valid });
    }
    const tooLarge = scan.skipped.filter((entry) => entry.reason === "too-large").map((entry) => entry.fileName);
    return { files, tooLarge, conflictCopies: scan.conflictCopies.filter((copy) => !ignored.has(nameKey(copy.fileName))), skipped: [...scan.skipped.map((entry) => entry.fileName), ...scan.notWorkspaceFiles] };
}

export interface Reconciliation {
    /** The file moved or was renamed outside; the document follows it. */
    renames: Array<{ docId: string; kind: DocKind; from: string; to: string }>;
    /** The file is gone and nothing carries the document's id. */
    detached: string[];
    /** Two or more files claim one document. */
    duplicates: Array<{ docId: string; kind: DocKind; files: string[] }>;
    /** Files no document claims. */
    unmatched: Array<{ kind: DocKind; fileName: string; id: string | null; valid: boolean }>;
}

/** Pure: compares the folder with the document rows. Rows that are excluded or have no file are left out of it. */
export function reconcile(rows: readonly WorkspaceDocRecord[], snapshot: FolderSnapshot): Reconciliation {
    const result: Reconciliation = { renames: [], detached: [], duplicates: [], unmatched: [] };
    const byId = new Map<string, SnapshotFile[]>();
    for (const file of snapshot.files) if (file.id) byId.set(file.id, [...(byId.get(file.id) ?? []), file]);
    const byName = new Map(snapshot.files.map((file) => [`${file.kind}:${nameKey(file.name)}`, file]));
    const claimed = new Set<SnapshotFile>();
    const tooLarge = new Set((snapshot.tooLarge ?? []).map(nameKey));

    for (const row of rows) {
        if (!row.included) {
            // Left out of the workspace on purpose: its file is still its own, never a stray or a new document.
            for (const file of snapshot.files) if (file.kind === row.kind && (file.id === row.docId || (row.fileName && nameKey(file.name) === nameKey(row.fileName)))) claimed.add(file);
            continue;
        }
        if (!row.fileName) continue;
        if (tooLarge.has(nameKey(row.fileName))) continue; // too large to read, but not gone
        const own = byName.get(`${row.kind}:${nameKey(row.fileName)}`);
        const sameId = (byId.get(row.docId) ?? []).filter((file) => file.kind === row.kind);
        const ownMatches = own && (own.id === null || own.id === row.docId);

        if (ownMatches) {
            claimed.add(own);
            const others = sameId.filter((file) => file !== own);
            if (others.length > 0) {
                others.forEach((file) => claimed.add(file));
                result.duplicates.push({ docId: row.docId, kind: row.kind, files: [own.name, ...others.map((file) => file.name)] });
            }
            continue;
        }
        // The expected file is gone (or now belongs to another document): look for the id elsewhere.
        if (sameId.length === 1) {
            claimed.add(sameId[0]);
            result.renames.push({ docId: row.docId, kind: row.kind, from: row.fileName, to: sameId[0].name });
        } else if (sameId.length > 1) {
            sameId.forEach((file) => claimed.add(file));
            result.duplicates.push({ docId: row.docId, kind: row.kind, files: sameId.map((file) => file.name) });
        } else {
            result.detached.push(row.docId);
        }
    }

    for (const file of snapshot.files) if (!claimed.has(file)) result.unmatched.push({ kind: file.kind, fileName: file.name, id: file.id, valid: file.valid });
    return result;
}

// -- what the person chose ------------------------------------------------------------------------

/** Points a document at a file it did not have before (relink, or choosing which duplicate to keep). */
export async function relinkDocument(docId: string, fileName: string, adapter: DirectoryAdapter, kind: DocKind): Promise<void> {
    const text = await adapter.readText(kind === "cv" ? "cvs" : "letters", fileName);
    await patchDocRow(docId, { fileName, state: "in-sync", reason: null, lastHash: text === null ? null : hashText(text), lastStamp: null });
}

/** Writes the app's version to a (new) file for a detached document. */
export async function recreateFile(docId: string, fileName: string, text: string, kind: DocKind, adapter: DirectoryAdapter): Promise<void> {
    await adapter.writeText(kind === "cv" ? "cvs" : "letters", fileName, text);
    await patchDocRow(docId, { fileName, state: "in-sync", reason: null, lastHash: hashText(text), lastStamp: null });
}
