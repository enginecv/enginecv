/**
 * The File System Access API pieces the linked-file feature uses. TypeScript's
 * DOM lib does not ship the picker functions or permission methods, so they
 * are declared here (Chromium only; everything is feature-detected).
 */

type FileSystemPermissionMode = "read" | "readwrite";
type FileSystemPermissionState = "granted" | "denied" | "prompt";

interface FilePickerAcceptType {
    description?: string;
    accept: Record<string, string[]>;
}

interface FilePickerOptionsBase {
    id?: string;
    startIn?: "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos" | FileSystemHandle;
    types?: FilePickerAcceptType[];
    excludeAcceptAllOption?: boolean;
}

interface OpenFilePickerOptions extends FilePickerOptionsBase {
    multiple?: boolean;
}

interface SaveFilePickerOptions extends FilePickerOptionsBase {
    suggestedName?: string;
}

interface FileSystemHandle {
    queryPermission?(descriptor?: { mode?: FileSystemPermissionMode }): Promise<FileSystemPermissionState>;
    requestPermission?(descriptor?: { mode?: FileSystemPermissionMode }): Promise<FileSystemPermissionState>;
}

interface FileSystemFileHandle {
    /** Chromium: rename in place. Absent elsewhere. */
    move?(newName: string): Promise<void>;
}

interface Window {
    showOpenFilePicker?(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
    showSaveFilePicker?(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
}
