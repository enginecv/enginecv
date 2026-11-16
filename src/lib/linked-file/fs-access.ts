/**
 * The only module that touches the File System Access API. The sync engine
 * talks to a `FileAdapter`, so it can run against an in-memory fake and a
 * later transport (MCP bridge, WebMCP) can reuse everything above it.
 */

export type FileErrorCode = "not-found" | "busy" | "permission" | "unknown";

export class FileAccessError extends Error {
    constructor(
        readonly code: FileErrorCode,
        message?: string,
    ) {
        super(message ?? code);
        this.name = "FileAccessError";
    }
}

export interface FileStamp {
    lastModified: number;
    size: number;
}

export interface FileAdapter {
    readonly name: string;
    stat(): Promise<FileStamp>;
    readText(): Promise<string>;
    writeText(text: string): Promise<void>;
    /** Renames the file in place. Throws `FileAccessError("unknown")` when unsupported or refused. */
    rename(newName: string): Promise<void>;
    /** True when readwrite permission is granted; `prompt` asks (needs a user gesture). */
    ensurePermission(prompt: boolean): Promise<boolean>;
    /** The current readwrite permission without asking. */
    permissionState(): Promise<"granted" | "prompt" | "denied">;
}

export const FILE_EXTENSION = ".enginecv.json";

const PICKER_ID = "enginecv-link";
const PICKER_TYPES: FilePickerAcceptType[] = [
    { description: "EngineCV file (JSON)", accept: { "application/json": [".json"] } },
];

export function isLinkingSupported(): boolean {
    return typeof window !== "undefined"
        && typeof window.showOpenFilePicker === "function"
        && typeof window.showSaveFilePicker === "function";
}

export function mapFileError(error: unknown): FileAccessError {
    if (error instanceof FileAccessError) return error;
    const name = (error as { name?: string } | null)?.name;
    switch (name) {
        case "NotFoundError":
            return new FileAccessError("not-found");
        case "NotAllowedError":
        case "SecurityError":
            return new FileAccessError("permission");
        case "NoModificationAllowedError":
        case "InvalidStateError":
            return new FileAccessError("busy");
        default:
            return new FileAccessError("unknown", (error as Error | null)?.message);
    }
}

export function createHandleAdapter(handle: FileSystemFileHandle): FileAdapter {
    return {
        get name() {
            return handle.name;
        },
        async stat() {
            try {
                const file = await handle.getFile();
                return { lastModified: file.lastModified, size: file.size };
            } catch (error) {
                throw mapFileError(error);
            }
        },
        async readText() {
            try {
                return await (await handle.getFile()).text();
            } catch (error) {
                throw mapFileError(error);
            }
        },
        async writeText(text) {
            try {
                // createWritable writes to a swap file and replaces the target on close,
                // so other programs never see a half-written file.
                const writable = await handle.createWritable();
                await writable.write(text);
                await writable.close();
            } catch (error) {
                throw mapFileError(error);
            }
        },
        async rename(newName) {
            if (typeof handle.move !== "function") throw new FileAccessError("unknown", "rename-unsupported");
            try {
                await handle.move(newName);
            } catch (error) {
                throw mapFileError(error);
            }
        },
        async permissionState() {
            if (typeof handle.queryPermission !== "function") return "granted";
            try {
                return await handle.queryPermission({ mode: "readwrite" });
            } catch (error) {
                throw mapFileError(error);
            }
        },
        async ensurePermission(prompt) {
            if (typeof handle.queryPermission !== "function") return true;
            try {
                const descriptor = { mode: "readwrite" as const };
                if ((await handle.queryPermission(descriptor)) === "granted") return true;
                if (!prompt || typeof handle.requestPermission !== "function") return false;
                return (await handle.requestPermission(descriptor)) === "granted";
            } catch (error) {
                throw mapFileError(error);
            }
        },
    };
}

/** Returns null when the person closes the dialog. */
export async function pickNewFile(suggestedName: string): Promise<FileSystemFileHandle | null> {
    if (!window.showSaveFilePicker) throw new FileAccessError("unknown", "unsupported");
    try {
        return await window.showSaveFilePicker({
            id: PICKER_ID,
            startIn: "documents",
            suggestedName,
            types: PICKER_TYPES,
        });
    } catch (error) {
        if ((error as { name?: string }).name === "AbortError") return null;
        throw mapFileError(error);
    }
}

export async function pickExistingFile(): Promise<FileSystemFileHandle | null> {
    if (!window.showOpenFilePicker) throw new FileAccessError("unknown", "unsupported");
    try {
        const [handle] = await window.showOpenFilePicker({
            id: PICKER_ID,
            startIn: "documents",
            multiple: false,
            types: PICKER_TYPES,
        });
        return handle ?? null;
    } catch (error) {
        if ((error as { name?: string }).name === "AbortError") return null;
        throw mapFileError(error);
    }
}
