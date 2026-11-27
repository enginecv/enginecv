import { FOLDERS } from "./names";
import { hashText } from "@/lib/workspace/hash";
import { agentFromText } from "./agent-name";
import { importApplicationFromText, importCvFromText, importLetterFromText } from "./apply-stored";
import type { DirectoryAdapter } from "./directory-adapter";
import type { Reconciliation } from "./documents";
import type { DocKind } from "./types";
import { newDocRow, putDocRow } from "./workspace-store";

/**
 * A complete CV, letter or job file that appears in the folder and belongs to no document (an agent made a
 * new one, or it was copied in) becomes a new document. Only files that already parsed are tried, so a
 * half-written file is left alone until it is finished, and a bad file stays in the "needs a look"
 * list instead of being retried on every scan.
 */

const FOLDER = FOLDERS;
/** A scan imports a few files at a time so a folder with many new files never stalls the page. */
export const IMPORTS_PER_SCAN = 5;

export interface Discovered {
    docId: string;
    kind: DocKind;
    fileName: string;
    notices: number;
    /** The agent that signed the file, when it did. */
    agent: string | null;
}

export async function importUnclaimed(adapter: DirectoryAdapter, unmatched: Reconciliation["unmatched"], options: { hideContact: boolean; now?: number }): Promise<{ imported: Discovered[]; failed: Array<{ fileName: string; code: string }> }> {
    const imported: Discovered[] = [];
    const failed: Array<{ fileName: string; code: string }> = [];
    const now = options.now ?? Date.now();
    for (const file of unmatched.filter((candidate) => candidate.valid).slice(0, IMPORTS_PER_SCAN)) {
        try {
            const text = await adapter.readText(FOLDER[file.kind], file.fileName);
            if (text === null) continue;
            const result = file.kind === "cv"
                ? await importCvFromText(text, { hideContact: options.hideContact, now })
                : file.kind === "letter"
                    ? await importLetterFromText(text, { now })
                    : await importApplicationFromText(text);
            if (!result.ok) {
                failed.push({ fileName: file.fileName, code: result.reason.code });
                continue;
            }
            // The row remembers the file as read, so the engine starts by noticing that only the app side differs (the id and the canonical layout still have to be written).
            await putDocRow(newDocRow({ docId: result.id, kind: file.kind, fileName: file.fileName, included: true, lastHash: hashText(text) }, now));
            imported.push({ docId: result.id, kind: file.kind, fileName: file.fileName, notices: result.notices.length, agent: agentFromText(text) });
        } catch {
            failed.push({ fileName: file.fileName, code: "unknown" });
        }
    }
    return { imported, failed };
}
