import { fileStemToTitle, suggestedFileName } from "./file-name";
import { getLink } from "./link-store";

export type RenameResult =
    | { ok: true; title: string; linked: boolean }
    | { ok: false; error: "linked" };

/**
 * Decides whether a CV may take a new name. A linked CV is named after its file,
 * and the app does not rename the file: a rename through the browser can replace
 * another file in the same folder, which the app has no way to look at first.
 * So a rename that would change the file name is refused; the person renames the
 * file in their file manager and relinks, and the CV takes the new name then.
 * An unlinked CV just gets the name it asked for.
 */
export async function renameLinkedCv(resumeId: string, newTitle: string): Promise<RenameResult> {
    const record = await getLink(resumeId);
    if (!record) return { ok: true, title: newTitle, linked: false };
    if (suggestedFileName(newTitle) === record.fileName) {
        return { ok: true, title: fileStemToTitle(record.fileName), linked: true };
    }
    return { ok: false, error: "linked" };
}
