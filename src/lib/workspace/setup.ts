import { db } from "@/lib/db";
import { hashText } from "@/lib/linked-file/hash";
import { applyLetterContent } from "@/lib/letters/apply-content";
import { letterFileText, parseLetterText } from "@/lib/letters/file-format";
import type { LetterDocument } from "@/lib/letters/schema";
import type { Resume } from "@/lib/schema";
import { AGENTS_FILE, GENERATED_MARK, MACHINE_DIR, README_FILE, agentsMarkdown, machineGitignore, readmeMarkdown, workspaceJson } from "./agent-files";
import { applyFileToStoredCv, applyFileToStoredLetter, importCvFromText, importLetterFromText } from "./apply-stored";
import { createCvCodec } from "./codecs/cv";
import type { DirectoryAdapter } from "./directory-adapter";
import { planFirstSync, type AppDocumentInfo, type FolderFileInfo, type PlanItem } from "./first-sync";
import { buildIndex, indexText } from "./index-file";
import { safeStem, uniqueFileName, keysOf, nameKey } from "./names";
import { classifyListing } from "./scan";
import { MAX_FILE_BYTES, type DocKind, type WorkspaceDocRecord } from "./types";
import { newDocRow, saveWorkspace } from "./workspace-store";
import { sectionCounts } from "@/lib/linked-file/apply-content";

/**
 * Connecting a folder: look at what is there, propose what to do with each document, and (once the
 * person confirms) write the files, apply or import the ones they chose, and record the workspace.
 * Existing files the app is about to replace are copied to `.enginecv/conflicts/` first.
 */

const cvCodec = createCvCodec();
const CV_DIR = "cvs";
const LETTER_DIR = "letters";
const FOLDER_OF: Record<DocKind, string> = { cv: CV_DIR, letter: LETTER_DIR };

export interface SetupOptions {
    hideContact: boolean;
    now?: number;
    appVersion?: string;
}

export interface SetupAnalysis {
    plan: PlanItem[];
    appDocs: AppDocumentInfo[];
    /** Files left out of the scan: too large, over the document limit, or not workspace files. */
    skipped: string[];
}

export const cvTitle = (cv: Resume) => cv.meta.title || cv.basics.name || "CV";
export const letterTitle = (letter: LetterDocument) => letter.title || [letter.company, letter.role].filter(Boolean).join(" - ") || "Letter";

export function appText(doc: Resume | LetterDocument, kind: DocKind, options: SetupOptions, titles: Map<string, string>): string {
    return kind === "cv"
        ? cvCodec.serialize(doc as Resume, { hideContact: options.hideContact })
        : letterFileText(doc as LetterDocument, { hideContact: options.hideContact, cvTitle: titles.get((doc as LetterDocument).cvId ?? "") });
}

/** The file names app documents would get: an earlier name is kept, a new one is made unique. */
export function assignFileNames(cvs: readonly Resume[], letters: readonly LetterDocument[], existing: ReadonlyMap<string, string | null>, takenNames: Iterable<string> = []): Map<string, string> {
    const taken = keysOf(takenNames);
    const names = new Map<string, string>();
    for (const [id, name] of existing) {
        if (name) {
            names.set(id, name);
            taken.add(nameKey(name));
        }
    }
    const give = (id: string, title: string, kind: DocKind) => {
        if (names.has(id)) return;
        const name = uniqueFileName(title, kind, taken);
        taken.add(nameKey(name));
        names.set(id, name);
    };
    for (const cv of cvs) give(cv.id ?? "", cvTitle(cv), "cv");
    for (const letter of letters) give(letter.id, letterTitle(letter), "letter");
    return names;
}

async function readFolderFiles(adapter: DirectoryAdapter): Promise<{ files: FolderFileInfo[]; skipped: string[] }> {
    const scan = classifyListing({ cvs: await adapter.listFiles(CV_DIR), letters: await adapter.listFiles(LETTER_DIR) });
    const files: FolderFileInfo[] = [];
    for (const doc of scan.documents) {
        const text = await adapter.readText(FOLDER_OF[doc.kind], doc.name);
        let id: string | null = null;
        if (text !== null) {
            if (doc.kind === "cv") {
                const parsed = cvCodec.parse(text, { now: 0, hideContact: false });
                id = parsed.ok ? parsed.id : null;
            } else {
                const parsed = parseLetterText(text);
                id = parsed.ok ? parsed.id : null;
            }
        }
        files.push({ kind: doc.kind, fileName: doc.name, text, id });
    }
    const skipped = [...scan.skipped.map((entry) => entry.fileName), ...scan.notWorkspaceFiles, ...scan.conflictCopies.map((copy) => copy.fileName)];
    return { files, skipped };
}

/** Looks at the folder and proposes what to do. Reads only; writes nothing. */
export async function analyzeFolder(adapter: DirectoryAdapter, docs: { cvs: Resume[]; letters: LetterDocument[] }, options: SetupOptions): Promise<SetupAnalysis> {
    const rows = new Map((await db.workspaceDocs.toArray()).map((row) => [row.docId, row]));
    const { files, skipped } = await readFolderFiles(adapter);
    const titles = new Map(docs.cvs.map((cv) => [cv.id ?? "", cvTitle(cv)]));
    const names = assignFileNames(docs.cvs, docs.letters, new Map([...rows].map(([id, row]) => [id, row.fileName])), files.map((file) => file.fileName));
    const appDocs: AppDocumentInfo[] = [
        ...docs.cvs.map((cv) => ({ id: cv.id ?? "", kind: "cv" as const, title: cvTitle(cv), fileName: names.get(cv.id ?? "") ?? "", text: appText(cv, "cv", options, titles), lastHash: rows.get(cv.id ?? "")?.lastHash ?? null })),
        ...docs.letters.map((letter) => ({ id: letter.id, kind: "letter" as const, title: letterTitle(letter), fileName: names.get(letter.id) ?? "", text: appText(letter, "letter", options, titles), lastHash: rows.get(letter.id)?.lastHash ?? null })),
    ];
    const byId = new Map<string, Resume | LetterDocument>([...docs.cvs.map((cv) => [cv.id ?? "", cv] as const), ...docs.letters.map((letter) => [letter.id, letter] as const)]);
    const sameContent = (info: AppDocumentInfo, fileText: string): boolean | null => {
        const doc = byId.get(info.id);
        if (!doc) return null;
        if (info.kind === "cv") {
            const parsed = cvCodec.parse(fileText, { now: 0, hideContact: options.hideContact });
            if (!parsed.ok) return null;
            // Same meaning means the same canonical text once the file is applied: formatting and key order do not count.
            const applied = cvCodec.apply(doc as Resume, parsed.doc, { hideContact: options.hideContact });
            return appText(applied, "cv", options, titles) === info.text;
        }
        const parsed = parseLetterText(fileText);
        if (!parsed.ok) return null;
        try {
            const next = applyLetterContent(doc as LetterDocument, parsed.content, 0);
            return appText({ ...next, updatedAt: (doc as LetterDocument).updatedAt }, "letter", options, titles) === info.text;
        } catch {
            return null;
        }
    };
    return { plan: planFirstSync({ appDocs, folderFiles: files, sameContent }), appDocs, skipped };
}

async function writeIfNotEdited(adapter: DirectoryAdapter, folder: string, name: string, text: string) {
    const existing = await adapter.readText(folder, name);
    if (existing !== null && !existing.startsWith(GENERATED_MARK)) return; // the person's own file: leave it
    await adapter.writeText(folder, name, text);
}

export interface SetupResult {
    written: number;
    applied: number;
    imported: number;
    kept: number;
    skipped: number;
    failed: Array<{ key: string; code: string }>;
}

/** Applies a confirmed plan and records the workspace. */
export async function runSetup(input: {
    adapter: DirectoryAdapter;
    handle: FileSystemDirectoryHandle;
    plan: PlanItem[];
    appDocs: AppDocumentInfo[];
    docs: { cvs: Resume[]; letters: LetterDocument[] };
    options: SetupOptions;
}): Promise<SetupResult> {
    const { adapter, plan, appDocs, options } = input;
    const now = options.now ?? Date.now();
    const result: SetupResult = { written: 0, applied: 0, imported: 0, kept: 0, skipped: 0, failed: [] };
    const infoById = new Map(appDocs.map((info) => [info.id, info]));
    const rows = new Map<string, WorkspaceDocRecord>();

    await saveWorkspace({ handle: input.handle, folderName: adapter.name, createdAt: now, formatVersion: 1, hideContact: options.hideContact, paused: false, changeSource: "poll" });
    for (const folder of [CV_DIR, LETTER_DIR, "exports"]) await adapter.writeText(folder, ".keep", "");

    const record = (docId: string, kind: DocKind, fileName: string | null, text: string | null, included: boolean) => {
        rows.set(docId, newDocRow({ docId, kind, fileName, included, lastHash: text === null ? null : hashText(text) }, now));
    };

    for (const item of plan) {
        try {
            const info = item.docId ? infoById.get(item.docId) : undefined;
            if (item.class === "only-in-folder" || (item.class === "conflict" && !info)) {
                if (item.choice === "import" && item.fileName) {
                    const text = await adapter.readText(FOLDER_OF[item.kind], item.fileName);
                    if (text === null || text.length > MAX_FILE_BYTES) { result.failed.push({ key: item.key, code: "too-large" }); continue; }
                    const imported = item.kind === "cv" ? await importCvFromText(text, { hideContact: options.hideContact, now }) : await importLetterFromText(text, { now });
                    if (!imported.ok) { result.failed.push({ key: item.key, code: imported.reason.code }); continue; }
                    record(imported.id, item.kind, item.fileName, text, true);
                    result.imported += 1;
                } else result.skipped += 1;
                continue;
            }
            if (!info) continue;
            const folder = FOLDER_OF[info.kind];
            const fileName = item.fileName ?? info.fileName;

            if (item.choice === "use-file" && item.fileName) {
                const text = await adapter.readText(folder, item.fileName);
                if (text === null) { result.failed.push({ key: item.key, code: "file-missing" }); continue; }
                const applied = info.kind === "cv" ? await applyFileToStoredCv(info.id, text, { hideContact: options.hideContact, now }) : await applyFileToStoredLetter(info.id, text, { now });
                if (!applied.ok) { result.failed.push({ key: item.key, code: applied.reason.code }); continue; }
                record(info.id, info.kind, item.fileName, text, true);
                result.applied += 1;
            } else if (item.choice === "keep-app") {
                const existing = await adapter.readText(folder, fileName);
                if (existing !== null && existing !== info.text) {
                    // The file is about to be replaced by the app's version: keep a copy.
                    await adapter.writeText(`${MACHINE_DIR}/conflicts`, `${safeStem(fileName)}.${now}.bak`, existing);
                }
                if (existing === null || existing !== info.text) {
                    await adapter.writeText(folder, fileName, info.text);
                    result.written += 1;
                } else result.kept += 1;
                record(info.id, info.kind, fileName, info.text, true);
            } else {
                // Skip: matching documents are simply in sync; the rest stay in the app only until the person includes them.
                if (item.class === "same") record(info.id, info.kind, item.fileName, info.text, true);
                else {
                    record(info.id, info.kind, item.fileName, null, false);
                    result.skipped += 1;
                }
            }
        } catch (error) {
            result.failed.push({ key: item.key, code: (error as { code?: string }).code ?? "unknown" });
        }
    }

    // Documents the plan did not mention (created during setup) are left for the controller's first scan.
    await db.workspaceDocs.bulkPut([...rows.values()]);

    const cvInputs = input.docs.cvs.map((cv) => ({ id: cv.id ?? "", fileName: rows.get(cv.id ?? "")?.fileName ?? "", title: cvTitle(cv), language: cv.settings.language || "en", updatedAt: cv.updatedAt, entries: sectionCounts(cv) })).filter((cv) => rows.get(cv.id)?.included && cv.fileName);
    const letterInputs = input.docs.letters.map((letter) => ({ id: letter.id, fileName: rows.get(letter.id)?.fileName ?? "", cvId: letter.cvId, company: letter.company, role: letter.role, status: (letter.status === "draft" ? "draft" : "sent") as "draft" | "sent", updatedAt: letter.updatedAt })).filter((letter) => rows.get(letter.id)?.included && letter.fileName);
    await adapter.writeText(MACHINE_DIR, "index.json", indexText(buildIndex({ cvs: cvInputs, letters: letterInputs, states: new Map(), now })));
    await adapter.writeText(MACHINE_DIR, "workspace.json", workspaceJson({ id: `ws-${now.toString(36)}`, createdAt: now, appVersion: options.appVersion ?? "dev", hideContact: options.hideContact }));
    await adapter.writeText(MACHINE_DIR, ".gitignore", machineGitignore());
    await writeIfNotEdited(adapter, "", README_FILE, readmeMarkdown());
    await writeIfNotEdited(adapter, "", AGENTS_FILE, agentsMarkdown());
    return result;
}
