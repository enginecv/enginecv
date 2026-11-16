import { db } from "@/lib/db";
import { useResumeStore } from "@/lib/store";
import { attachLink, detachLink, getActiveEngine } from "./controller";
import { fileStemToTitle, suggestedFileName } from "./file-name";
import {
    FileAccessError,
    createHandleAdapter,
    pickExistingFile,
    pickNewFile,
    type FileAdapter,
} from "./fs-access";
import { LinkedElsewhereError, getLink, removeLink, saveLink } from "./link-store";
import { canonicalText } from "./sync-engine";

export type ExistingChoice = "load" | "overwrite";

export interface LinkOptions {
    /** Resolves false to abort with nothing written. */
    confirmPrivacy?: () => Promise<boolean>;
    /** Asked when the chosen file already exists; null cancels. Never decided silently. */
    confirmExisting?: () => Promise<ExistingChoice | null>;
    pickNew?: typeof pickNewFile;
    pickExisting?: typeof pickExistingFile;
}

export type LinkResult =
    | { ok: true }
    | { ok: false; reason: "cancelled" }
    | { ok: false; reason: "linked-elsewhere"; ownerResumeId: string; ownerTitle: string }
    | { ok: false; reason: "failed"; detail?: string };

async function finish(resumeId: string, handle: FileSystemFileHandle, adapter: FileAdapter, mode: "adopt" | "load") {
    const record = { resumeId, handle, fileName: adapter.name, linkedAt: Date.now(), paused: false };
    await saveLink(record);
    // Name the CV after the file; the file name is the CV name while linked.
    useResumeStore.getState().updateMeta({ title: fileStemToTitle(adapter.name) });
    await attachLink(record, mode);
    // Ask the browser not to evict the database (and with it the link); never wait for the answer.
    try {
        void navigator.storage?.persist?.();
    } catch {
        // Not available: nothing to do.
    }
}

export async function linkFile(resumeId: string, mode: "createNew" | "useExisting", options: LinkOptions = {}): Promise<LinkResult> {
    const confirmPrivacy = options.confirmPrivacy ?? (async () => true);
    const pickNew = options.pickNew ?? pickNewFile;
    const pickExisting = options.pickExisting ?? pickExistingFile;

    try {
        if (!(await confirmPrivacy())) return { ok: false, reason: "cancelled" };

        if (mode === "createNew") {
            const title = useResumeStore.getState().resume.meta.title || useResumeStore.getState().resume.basics.name;
            const handle = await pickNew(suggestedFileName(title || ""));
            if (!handle) return { ok: false, reason: "cancelled" };
            const adapter = createHandleAdapter(handle);
            if (!(await adapter.ensurePermission(true))) return { ok: false, reason: "failed", detail: "permission" };
            const record = { resumeId, handle, fileName: adapter.name, linkedAt: Date.now(), paused: false };
            // Claim the file first so a file another CV owns is never written to.
            await saveLink(record);
            try {
                await adapter.writeText(canonicalText(useResumeStore.getState().resume));
            } catch (error) {
                await removeLink(resumeId);
                throw error;
            }
            await finish(resumeId, handle, adapter, "adopt");
            return { ok: true };
        }

        const handle = await pickExisting();
        if (!handle) return { ok: false, reason: "cancelled" };
        const adapter = createHandleAdapter(handle);
        if (!(await adapter.ensurePermission(true))) return { ok: false, reason: "failed", detail: "permission" };
        const choice = await (options.confirmExisting?.() ?? Promise.resolve<ExistingChoice | null>("load"));
        if (!choice) return { ok: false, reason: "cancelled" };
        await saveLink({ resumeId, handle, fileName: adapter.name, linkedAt: Date.now(), paused: false });
        if (choice === "overwrite") {
            try {
                await adapter.writeText(canonicalText(useResumeStore.getState().resume));
            } catch (error) {
                await removeLink(resumeId);
                throw error;
            }
        }
        await finish(resumeId, handle, adapter, choice === "overwrite" ? "adopt" : "load");
        return { ok: true };
    } catch (error) {
        if (error instanceof LinkedElsewhereError) {
            const owner = await db.resumes.get(error.ownerResumeId).catch(() => undefined);
            return {
                ok: false,
                reason: "linked-elsewhere",
                ownerResumeId: error.ownerResumeId,
                ownerTitle: owner?.meta?.title || owner?.basics?.name || error.ownerResumeId,
            };
        }
        return { ok: false, reason: "failed", detail: error instanceof FileAccessError ? error.code : undefined };
    }
}

/** Ends the link without touching the file or the CV's content. */
export async function unlinkFile(resumeId: string): Promise<void> {
    if (getActiveEngine(resumeId)) detachLink();
    await removeLink(resumeId);
    useResumeStore.getState().resetLinkedFile();
}

/** Relink: choose another file for the same CV; adopts its name as the CV name. */
export async function relinkFile(resumeId: string, mode: "createNew" | "useExisting", options: LinkOptions = {}): Promise<LinkResult> {
    const previous = await getLink(resumeId);
    detachLink();
    const result = await linkFile(resumeId, mode, { ...options, confirmPrivacy: async () => true });
    if (!result.ok && previous) {
        // Keep the old link when the new one did not happen.
        await saveLink(previous).catch(() => undefined);
        useResumeStore.getState().setLinkedFile({ status: "broken" });
    }
    return result;
}
