import { hashText } from "@/lib/workspace/hash";
import { nameKey, parseDocumentFileName } from "./names";
import type { DocKind } from "./types";

/**
 * Compares what the app has with what a picked folder already holds, and proposes what to do with
 * each document. Nothing is decided for the person: every differing document defaults to keeping the
 * app's version, an unfamiliar file is never imported unless ticked, and nothing is written or applied
 * until the list is confirmed (spec story 1, scenario 3).
 */

export type SyncClass = "same" | "app-newer" | "file-newer" | "differs" | "only-in-app" | "only-in-folder" | "conflict";
export type PlanChoice = "keep-app" | "use-file" | "skip" | "import";

export interface AppDocumentInfo {
    id: string;
    kind: DocKind;
    title: string;
    /** The file name this document gets in the folder. */
    fileName: string;
    /** Canonical text the app would write. */
    text: string;
    /** Hash of the text last synced with a file, when there is one (from a previous setup). */
    lastHash: string | null;
}

export interface FolderFileInfo {
    kind: DocKind;
    fileName: string;
    /** File text, or null when it could not be read (too large, unreadable). */
    text: string | null;
    /** The document id written in the file, when it has one and parses. */
    id: string | null;
}

export interface PlanItem {
    key: string;
    kind: DocKind;
    class: SyncClass;
    title: string;
    docId: string | null;
    fileName: string | null;
    choice: PlanChoice;
    /** Choices the dialog offers for this row. */
    choices: PlanChoice[];
}

export interface PlanInput {
    appDocs: readonly AppDocumentInfo[];
    folderFiles: readonly FolderFileInfo[];
    /** True when file text and app text mean the same thing (formatting aside). Null: the file is not valid. */
    sameContent: (doc: AppDocumentInfo, fileText: string) => boolean | null;
}

export function planFirstSync(input: PlanInput): PlanItem[] {
    const items: PlanItem[] = [];
    const filesById = new Map<string, FolderFileInfo[]>();
    const unclaimed: FolderFileInfo[] = [];
    for (const file of input.folderFiles) {
        if (file.id) filesById.set(file.id, [...(filesById.get(file.id) ?? []), file]);
        else unclaimed.push(file);
    }
    const claimed = new Set<FolderFileInfo>();
    const byName = new Map(unclaimed.map((file) => [`${file.kind}:${nameKey(file.fileName)}`, file]));

    for (const doc of input.appDocs) {
        const matches = filesById.get(doc.id) ?? [];
        const byFileName = matches.length === 0 ? byName.get(`${doc.kind}:${nameKey(doc.fileName)}`) : undefined;
        const found = matches.length > 0 ? matches : byFileName ? [byFileName] : [];
        found.forEach((file) => claimed.add(file));

        if (found.length === 0) {
            items.push({ key: `app:${doc.id}`, kind: doc.kind, class: "only-in-app", title: doc.title, docId: doc.id, fileName: null, choice: "keep-app", choices: ["keep-app", "skip"] });
            continue;
        }
        if (found.length > 1) {
            // Two files claim one document: show both, apply neither.
            for (const file of found) items.push({ key: `conflict:${file.fileName}`, kind: doc.kind, class: "conflict", title: doc.title, docId: doc.id, fileName: file.fileName, choice: "skip", choices: ["skip", "use-file"] });
            continue;
        }
        const file = found[0];
        const same = file.text === null ? null : input.sameContent(doc, file.text);
        let cls: SyncClass = "differs";
        if (same === true) cls = "same";
        else if (same === false && file.text !== null && doc.lastHash) {
            const fileHash = hashText(file.text);
            const appHash = hashText(doc.text);
            if (fileHash === doc.lastHash) cls = "app-newer";
            else if (appHash === doc.lastHash) cls = "file-newer";
        }
        items.push({
            key: `pair:${doc.id}`,
            kind: doc.kind,
            class: cls,
            title: doc.title,
            docId: doc.id,
            fileName: file.fileName,
            choice: cls === "same" ? "skip" : "keep-app",
            choices: cls === "same" ? ["skip"] : same === null ? ["keep-app", "skip"] : ["keep-app", "use-file", "skip"],
        });
    }

    for (const [id, files] of filesById) {
        if (input.appDocs.some((doc) => doc.id === id)) continue;
        for (const file of files) {
            claimed.add(file);
            items.push(onlyInFolder(file, files.length > 1 ? "conflict" : "only-in-folder"));
        }
    }
    for (const file of unclaimed) if (!claimed.has(file)) items.push(onlyInFolder(file, "only-in-folder"));
    return items;
}

function onlyInFolder(file: FolderFileInfo, cls: SyncClass): PlanItem {
    const parsed = parseDocumentFileName(file.fileName);
    return {
        key: `file:${file.fileName}`,
        kind: file.kind,
        class: cls,
        title: parsed?.stem ?? file.fileName,
        docId: null,
        fileName: file.fileName,
        // An unfamiliar file is never imported unless the person ticks it.
        choice: "skip",
        choices: file.text === null || cls === "conflict" ? ["skip"] : ["skip", "import"],
    };
}
