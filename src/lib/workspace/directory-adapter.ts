import { FileAccessError, createHandleAdapter, mapFileError, type FileAdapter } from "@/lib/linked-file/fs-access";
import type { ListedFile } from "./scan";

/**
 * The folder, as the rest of the workspace code sees it: list a sub-folder with timestamps, read
 * and write whole files atomically, hand out a `FileAdapter` for one document file, and report
 * permission. Everything above this (scan rules, the sync engine, the controller) is testable
 * against the in-memory directory because it only talks to this interface.
 */

export interface DirectoryAdapter {
    readonly name: string;
    /** Files directly inside `folder` (a `/`-separated path under the workspace root), with size and time. Missing folder: empty. */
    listFiles(folder: string): Promise<ListedFile[]>;
    /** Names of the folders directly inside `folder`. */
    listFolders(folder: string): Promise<string[]>;
    readText(folder: string, name: string): Promise<string | null>;
    /** Writes the whole file (creating folders and the file as needed) through a writable stream. */
    writeText(folder: string, name: string, text: string): Promise<void>;
    remove(folder: string, name: string): Promise<void>;
    exists(folder: string, name: string): Promise<boolean>;
    /** A file adapter for one document, creating the file when `create` is set. */
    fileAdapter(folder: string, name: string, options?: { create?: boolean }): Promise<FileAdapter>;
    permissionState(): Promise<"granted" | "prompt" | "denied">;
    /** True when readwrite permission is granted; `prompt` asks (needs a user gesture). */
    ensurePermission(prompt: boolean): Promise<boolean>;
}

type Iterable = { entries(): AsyncIterable<[string, FileSystemHandle]> };

const segments = (path: string) => path.split("/").filter(Boolean);

export function createDirectoryAdapter(root: FileSystemDirectoryHandle): DirectoryAdapter {
    async function resolve(path: string, create: boolean): Promise<FileSystemDirectoryHandle | null> {
        let dir = root;
        for (const part of segments(path)) {
            try {
                dir = await dir.getDirectoryHandle(part, { create });
            } catch (error) {
                if (!create && (error as { name?: string }).name === "NotFoundError") return null;
                throw mapFileError(error);
            }
        }
        return dir;
    }

    async function fileHandle(folder: string, name: string, create: boolean): Promise<FileSystemFileHandle | null> {
        const dir = await resolve(folder, create);
        if (!dir) return null;
        try {
            return await dir.getFileHandle(name, { create });
        } catch (error) {
            if ((error as { name?: string }).name === "NotFoundError") return null;
            throw mapFileError(error);
        }
    }

    return {
        get name() {
            return root.name;
        },

        async listFiles(folder) {
            const dir = await resolve(folder, false);
            if (!dir) return [];
            const files: ListedFile[] = [];
            try {
                for await (const [name, handle] of (dir as unknown as Iterable).entries()) {
                    if (handle.kind !== "file") continue;
                    // A file that vanishes between listing and reading is simply not listed.
                    try {
                        const file = await (handle as FileSystemFileHandle).getFile();
                        files.push({ name, size: file.size, lastModified: file.lastModified });
                    } catch (error) {
                        if ((error as { name?: string }).name !== "NotFoundError") throw error;
                    }
                }
            } catch (error) {
                throw mapFileError(error);
            }
            return files;
        },

        async listFolders(folder) {
            const dir = await resolve(folder, false);
            if (!dir) return [];
            const names: string[] = [];
            try {
                for await (const [name, handle] of (dir as unknown as Iterable).entries()) if (handle.kind === "directory") names.push(name);
            } catch (error) {
                throw mapFileError(error);
            }
            return names;
        },

        async readText(folder, name) {
            const handle = await fileHandle(folder, name, false);
            if (!handle) return null;
            try {
                return await (await handle.getFile()).text();
            } catch (error) {
                if ((error as { name?: string }).name === "NotFoundError") return null;
                throw mapFileError(error);
            }
        },

        async writeText(folder, name, text) {
            const handle = await fileHandle(folder, name, true);
            if (!handle) throw new FileAccessError("not-found");
            await createHandleAdapter(handle).writeText(text);
        },

        async remove(folder, name) {
            const dir = await resolve(folder, false);
            if (!dir) return;
            try {
                await dir.removeEntry(name);
            } catch (error) {
                if ((error as { name?: string }).name === "NotFoundError") return;
                throw mapFileError(error);
            }
        },

        async exists(folder, name) {
            return (await fileHandle(folder, name, false)) !== null;
        },

        async fileAdapter(folder, name, options = {}) {
            const handle = await fileHandle(folder, name, options.create ?? false);
            if (!handle) throw new FileAccessError("not-found");
            return createHandleAdapter(handle);
        },

        async permissionState() {
            if (typeof root.queryPermission !== "function") return "granted";
            try {
                return await root.queryPermission({ mode: "readwrite" });
            } catch (error) {
                throw mapFileError(error);
            }
        },

        async ensurePermission(prompt) {
            if (typeof root.queryPermission !== "function") return true;
            try {
                const descriptor = { mode: "readwrite" as const };
                if ((await root.queryPermission(descriptor)) === "granted") return true;
                if (!prompt || typeof root.requestPermission !== "function") return false;
                return (await root.requestPermission(descriptor)) === "granted";
            } catch (error) {
                throw mapFileError(error);
            }
        },
    };
}

/** Folder-picker support: a desktop Chromium browser with directory access. */
export function isWorkspaceSupported(): boolean {
    return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

/** Returns null when the person closes the dialog. */
export async function pickWorkspaceFolder(): Promise<FileSystemDirectoryHandle | null> {
    if (!isWorkspaceSupported()) throw new FileAccessError("unknown", "unsupported");
    try {
        return await window.showDirectoryPicker!({ id: "enginecv-workspace", mode: "readwrite", startIn: "documents" });
    } catch (error) {
        if ((error as { name?: string }).name === "AbortError") return null;
        throw mapFileError(error);
    }
}
