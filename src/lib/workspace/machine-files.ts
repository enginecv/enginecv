import { sectionCounts } from "@/lib/linked-file/apply-content";
import {
    AGENTS_FILE,
    MACHINE_DIR,
    README_FILE,
    REFERENCE_DIR,
    agentsMarkdown,
    isUntouched,
    machineGitignore,
    readmeMarkdown,
    referenceFiles,
    workspaceJson,
} from "./agent-files";
import { readAppDocuments } from "./apply-stored";
import type { DirectoryAdapter } from "./directory-adapter";
import { buildIndex, indexText, type IndexDocState, type WorkspaceIndex } from "./index-file";
import { cvTitle } from "./titles";
import { getWorkspace, listDocRows } from "./workspace-store";

/**
 * The files EngineCV keeps for agents: instructions, references, the index. All of them can be made
 * again from the app's own state, so deleting `.enginecv/` costs nothing, and none of them ever
 * touches a document. A file the person edited is left as it is: a changed `AGENTS.md` or `README.md`
 * gets the fresh version written beside it instead.
 */

const KEEP_FOLDERS = ["cvs", "letters", "exports", `${MACHINE_DIR}/requests`, `${MACHINE_DIR}/results`];

export interface MachineFilesResult {
    written: string[];
    /** Files the person edited: the fresh copy went to this path instead. */
    freshCopies: string[];
}

/** Writes `fresh` where `name` lives unless the person changed what is there. Returns what happened. */
async function syncGenerated(adapter: DirectoryAdapter, folder: string, name: string, fresh: string, freshCopyAt: { folder: string; name: string } | null): Promise<"written" | "fresh-copy" | "same" | "left"> {
    const existing = await adapter.readText(folder, name);
    if (existing === fresh) return "same";
    if (existing === null || isUntouched(existing)) {
        await adapter.writeText(folder, name, fresh);
        return "written";
    }
    if (!freshCopyAt) return "left";
    if ((await adapter.readText(freshCopyAt.folder, freshCopyAt.name)) === fresh) return "same";
    await adapter.writeText(freshCopyAt.folder, freshCopyAt.name, fresh);
    return "fresh-copy";
}

/** Everything except the index: folders, ignore file, workspace marker, instructions and references. */
export async function ensureMachineFiles(adapter: DirectoryAdapter, options: { hideContact: boolean; appVersion?: string; now?: number }): Promise<MachineFilesResult> {
    const result: MachineFilesResult = { written: [], freshCopies: [] };
    const note = (kind: string, path: string) => {
        if (kind === "written") result.written.push(path);
        if (kind === "fresh-copy") result.freshCopies.push(path);
    };

    for (const folder of KEEP_FOLDERS) if (!(await adapter.exists(folder, ".keep"))) await adapter.writeText(folder, ".keep", "");

    if ((await adapter.readText(MACHINE_DIR, ".gitignore")) !== machineGitignore()) {
        await adapter.writeText(MACHINE_DIR, ".gitignore", machineGitignore());
        result.written.push(`${MACHINE_DIR}/.gitignore`);
    }
    if (!(await adapter.exists(MACHINE_DIR, "workspace.json"))) {
        const workspace = await getWorkspace();
        const created = workspace?.createdAt ?? options.now ?? Date.now();
        await adapter.writeText(MACHINE_DIR, "workspace.json", workspaceJson({ id: `ws-${created.toString(36)}`, createdAt: created, appVersion: options.appVersion ?? "dev", hideContact: options.hideContact }));
        result.written.push(`${MACHINE_DIR}/workspace.json`);
    }

    note(await syncGenerated(adapter, "", AGENTS_FILE, agentsMarkdown(), { folder: REFERENCE_DIR, name: "AGENTS.fresh.md" }), AGENTS_FILE);
    note(await syncGenerated(adapter, "", README_FILE, readmeMarkdown(), { folder: REFERENCE_DIR, name: "README.fresh.md" }), README_FILE);
    for (const [name, text] of Object.entries(referenceFiles())) note(await syncGenerated(adapter, REFERENCE_DIR, name, text, null), `${REFERENCE_DIR}/${name}`);
    return result;
}

/** The index as an object: the same summary the file holds, for the file and for in-browser tools. */
export async function computeIndex(): Promise<WorkspaceIndex> {
    const docs = await readAppDocuments();
    const rows = new Map((await listDocRows()).map((row) => [row.docId, row]));
    const states = new Map<string, IndexDocState>([...rows].map(([id, row]) => [id, { state: row.state, reason: row.reason }]));

    const cvs = docs.cvs
        .map((cv) => ({ cv, row: rows.get(cv.id ?? "") }))
        .filter(({ row }) => row?.included && row.fileName)
        .map(({ cv, row }) => ({ id: cv.id ?? "", fileName: row!.fileName!, title: cvTitle(cv), language: cv.settings.language || "en", updatedAt: cv.updatedAt, entries: sectionCounts(cv) }));
    const letters = docs.letters
        .map((letter) => ({ letter, row: rows.get(letter.id) }))
        .filter(({ row }) => row?.included && row.fileName)
        .map(({ letter, row }) => ({ id: letter.id, fileName: row!.fileName!, cvId: letter.cvId, company: letter.company, role: letter.role, status: (letter.status === "draft" ? "draft" : "sent") as "draft" | "sent", updatedAt: letter.updatedAt }));

    // The time is the newest document change, so an unchanged workspace gives an identical file and nothing is rewritten.
    const updated = Math.max(0, ...cvs.map((cv) => cv.updatedAt), ...letters.map((letter) => letter.updatedAt));
    return buildIndex({ cvs, letters, states, now: updated });
}

/** `.enginecv/index.json` from the documents as they are now. Returns true when the file changed. */
export async function refreshIndex(adapter: DirectoryAdapter): Promise<boolean> {
    const text = indexText(await computeIndex());
    if ((await adapter.readText(MACHINE_DIR, "index.json")) === text) return false;
    await adapter.writeText(MACHINE_DIR, "index.json", text);
    return true;
}
