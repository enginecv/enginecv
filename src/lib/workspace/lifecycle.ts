import { db } from "@/lib/db";
import { hashText } from "@/lib/workspace/hash";
import type { LetterDocument } from "@/lib/letters/schema";
import type { Resume } from "@/lib/schema";
import { MACHINE_DIR } from "./agent-files";
import { applyFileToStoredCv, applyFileToStoredLetter, readAppDocuments } from "./apply-stored";
import type { DirectoryAdapter } from "./directory-adapter";
import { readFolderSnapshot, type FolderSnapshot, type IdCache } from "./documents";
import { keysOf, nameKey, safeStem, uniqueFileName } from "./names";
import { appText, cvTitle, letterTitle } from "./setup";
import type { DocKind, WorkspaceDocRecord } from "./types";
import { getWorkspace, listDocRows, newDocRow, patchDocRow, putDocRow, removeDocRow, updateWorkspace } from "./workspace-store";

/**
 * Documents come and go in the app while a workspace is connected. New ones get a file, a renamed one
 * gets a new file name through the same clash check as setup (never onto an existing name), a deleted
 * one only loses its row (its file stays, and shows up as an unclaimed file), and the person can leave a
 * document out of the folder and bring it back with the same choice the first sync offers.
 * Nothing here deletes a file unless the person said so for that document.
 */

const FOLDER: Record<DocKind, string> = { cv: "cvs", letter: "letters" };

export interface MirrorResult {
    created: string[];
    renamed: string[];
    orphaned: string[];
    failed: string[];
}

interface Options {
    hideContact: boolean;
    now?: number;
}

async function takenKeys(adapter: DirectoryAdapter, rows: readonly WorkspaceDocRecord[], kind: DocKind, exceptDocId?: string): Promise<Set<string>> {
    const keys = keysOf((await adapter.listFiles(FOLDER[kind])).map((file) => file.name));
    for (const row of rows) if (row.kind === kind && row.fileName && row.docId !== exceptDocId) keys.add(nameKey(row.fileName));
    // The document's own file does not clash with itself.
    const own = exceptDocId ? rows.find((row) => row.docId === exceptDocId)?.fileName : null;
    if (own) keys.delete(nameKey(own));
    return keys;
}

const titleMap = (docs: { cvs: Resume[]; letters: LetterDocument[] }) => new Map(docs.cvs.map((cv) => [cv.id ?? "", cvTitle(cv)]));

/** Brings the folder and the document rows in line with the documents that exist now. Safe to run repeatedly. */
export async function mirrorDocuments(adapter: DirectoryAdapter, options: Options): Promise<MirrorResult> {
    const now = options.now ?? Date.now();
    const result: MirrorResult = { created: [], renamed: [], orphaned: [], failed: [] };
    const docs = await readAppDocuments();
    const rows = await listDocRows();
    const byId = new Map(rows.map((row) => [row.docId, row]));
    const titles = titleMap(docs);
    const entries: Array<{ id: string; kind: DocKind; title: string; doc: Resume | LetterDocument }> = [
        ...docs.cvs.filter((cv) => cv.id).map((cv) => ({ id: cv.id!, kind: "cv" as const, title: cvTitle(cv), doc: cv })),
        ...docs.letters.map((letter) => ({ id: letter.id, kind: "letter" as const, title: letterTitle(letter), doc: letter as Resume | LetterDocument })),
    ];
    const live = new Set(entries.map((entry) => entry.id));

    for (const row of rows) {
        if (!live.has(row.docId)) {
            await removeDocRow(row.docId);
            result.orphaned.push(row.docId);
            // Deleted in the app without a word about its file: the file stays, but it is not a new document.
            if (row.fileName) {
                const workspace = await getWorkspace();
                await updateWorkspace({ ignoredFiles: [...new Set([...(workspace?.ignoredFiles ?? []), row.fileName])] });
            }
        }
    }

    // Files no row claims: a document that comes back (an undone delete) adopts its own file instead of getting a second one.
    let unclaimed: FolderSnapshot | null = null;
    const idCache: IdCache = new Map();
    const claimedKeys = new Set(rows.filter((row) => row.fileName).map((row) => `${row.kind}:${nameKey(row.fileName!)}`));

    for (const entry of entries) {
        const row = byId.get(entry.id);
        try {
            if (!row) {
                unclaimed ??= await readFolderSnapshot(adapter, idCache);
                const own = unclaimed.files.find((file) => file.kind === entry.kind && file.id === entry.id && !claimedKeys.has(`${file.kind}:${nameKey(file.name)}`));
                if (own) {
                    const adopted = newDocRow({ docId: entry.id, kind: entry.kind, fileName: own.name, included: true }, now);
                    await putDocRow(adopted);
                    rows.push(adopted);
                    claimedKeys.add(`${entry.kind}:${nameKey(own.name)}`);
                    result.created.push(entry.id);
                    continue;
                }
                const taken = await takenKeys(adapter, rows, entry.kind);
                const fileName = uniqueFileName(entry.title, entry.kind, taken);
                const text = appText(entry.doc, entry.kind, { hideContact: options.hideContact, now }, titles);
                await adapter.writeText(FOLDER[entry.kind], fileName, text);
                const created = newDocRow({ docId: entry.id, kind: entry.kind, fileName, included: true, lastHash: hashText(text) }, now);
                await putDocRow(created);
                rows.push(created);
                result.created.push(entry.id);
                continue;
            }
            if (!row.included || !row.fileName || row.state !== "in-sync") continue;
            const taken = await takenKeys(adapter, rows, entry.kind, entry.id);
            const wanted = uniqueFileName(entry.title, entry.kind, taken);
            if (nameKey(wanted) === nameKey(row.fileName)) continue;
            const current = await adapter.readText(FOLDER[entry.kind], row.fileName);
            if (current === null) continue; // the file is gone: reconciliation detaches it
            await adapter.writeText(FOLDER[entry.kind], wanted, current);
            await adapter.remove(FOLDER[entry.kind], row.fileName);
            await patchDocRow(entry.id, { fileName: wanted }, now);
            row.fileName = wanted;
            result.renamed.push(entry.id);
        } catch {
            result.failed.push(entry.id);
        }
    }
    return result;
}

async function backupFile(adapter: DirectoryAdapter, kind: DocKind, fileName: string, now: number): Promise<void> {
    const text = await adapter.readText(FOLDER[kind], fileName);
    if (text !== null) await adapter.writeText(`${MACHINE_DIR}/conflicts`, `${safeStem(fileName)}.${now}.bak`, text);
}

/** The document leaves the folder's care; its file is left as it is. */
export async function excludeDocument(docId: string): Promise<void> {
    await patchDocRow(docId, { included: false });
}

export type IncludeChoice = "keep-app" | "use-file";

/** Brings a left-out document back. A file that already exists is either replaced by the app's version (copied first) or applied. */
export async function includeDocument(adapter: DirectoryAdapter, docId: string, choice: IncludeChoice, options: Options): Promise<{ ok: boolean; fileName: string | null }> {
    const now = options.now ?? Date.now();
    const docs = await readAppDocuments();
    const rows = await listDocRows();
    const row = rows.find((candidate) => candidate.docId === docId);
    const cv = docs.cvs.find((candidate) => candidate.id === docId);
    const letter = docs.letters.find((candidate) => candidate.id === docId);
    const doc = cv ?? letter;
    if (!row || !doc) return { ok: false, fileName: null };
    const kind = row.kind;
    const titles = titleMap(docs);
    const fileName = row.fileName ?? uniqueFileName(cv ? cvTitle(cv) : letterTitle(letter!), kind, await takenKeys(adapter, rows, kind, docId));
    const existing = await adapter.readText(FOLDER[kind], fileName);

    if (existing !== null && choice === "use-file") {
        const applied = kind === "cv" ? await applyFileToStoredCv(docId, existing, { hideContact: options.hideContact, now }) : await applyFileToStoredLetter(docId, existing, { now });
        if (!applied.ok) return { ok: false, fileName };
        await patchDocRow(docId, { included: true, fileName, state: "in-sync", reason: null, lastHash: hashText(existing) }, now);
        return { ok: true, fileName };
    }

    const text = appText(doc, kind, { hideContact: options.hideContact, now }, titles);
    if (existing !== null && existing !== text) await backupFile(adapter, kind, fileName, now);
    await adapter.writeText(FOLDER[kind], fileName, text);
    await patchDocRow(docId, { included: true, fileName, state: "in-sync", reason: null, lastHash: hashText(text) }, now);
    return { ok: true, fileName };
}

export type RetireChoice = "keep-file" | "delete-file";

/**
 * Called before a document is deleted in the app. "Keep" leaves the file in the folder (it becomes an
 * unclaimed file); "delete" removes it, after copying it to `.enginecv/conflicts` so a mistake is recoverable.
 */
export async function retireDocument(adapter: DirectoryAdapter, docId: string, choice: RetireChoice, now: number = Date.now()): Promise<void> {
    const row = (await listDocRows()).find((candidate) => candidate.docId === docId);
    if (!row) return;
    if (choice === "delete-file" && row.fileName) {
        await backupFile(adapter, row.kind, row.fileName, now);
        await adapter.remove(FOLDER[row.kind], row.fileName);
    }
    await removeDocRow(docId);
    // A file kept on purpose is not a new document: it is left alone and not reported again.
    if (choice === "keep-file" && row.fileName) {
        const workspace = await getWorkspace();
        await updateWorkspace({ ignoredFiles: [...new Set([...(workspace?.ignoredFiles ?? []), row.fileName])] });
    }
}

/** True when the workspace has a file for this document, so deleting it should ask about the file. */
export async function hasWorkspaceFile(docId: string): Promise<boolean> {
    const row = await db.workspaceDocs.get(docId);
    return !!row && row.included && !!row.fileName;
}
