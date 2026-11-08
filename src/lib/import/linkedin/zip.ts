import { unzipSync } from "fflate";
import { LinkedinImportError } from "./errors";

export const RECOGNIZED_FILES = [
    "profile",
    "positions",
    "education",
    "skills",
    "certifications",
    "languages",
    "projects",
] as const;

export type RecognizedFile = (typeof RECOGNIZED_FILES)[number];

/** ZIP local-file-header magic: "PK\x03\x04". */
export function isZipData(data: Uint8Array): boolean {
    return data.length >= 4 && data[0] === 0x50 && data[1] === 0x4b && data[2] === 0x03 && data[3] === 0x04;
}

export function recognizedFileForName(name: string): RecognizedFile | null {
    const basename = name.split("/").pop() ?? name;
    const match = /^(.+)\.csv$/i.exec(basename.trim());
    if (!match) return null;
    const stem = match[1].toLowerCase() as RecognizedFile;
    return RECOGNIZED_FILES.includes(stem) ? stem : null;
}

/**
 * Extract the text of recognized CSV entries from archive bytes. Only
 * matching entries are inflated — media and message folders in a full
 * archive are skipped at the central-directory level, which keeps even
 * large exports cheap. Encrypted or undecodable archives surface as the
 * corrupt-archive failure class.
 */
export function extractRecognizedEntries(data: Uint8Array): Map<RecognizedFile, string> {
    const result = new Map<RecognizedFile, string>();
    let inflated: Record<string, Uint8Array>;

    try {
        inflated = unzipSync(data, {
            filter: (info) => recognizedFileForName(info.name) !== null,
        });
    } catch {
        throw new LinkedinImportError("corrupt-archive");
    }

    const decoder = new TextDecoder("utf-8", { fatal: false });
    for (const [name, bytes] of Object.entries(inflated)) {
        const recognized = recognizedFileForName(name);
        if (!recognized || result.has(recognized)) continue;
        result.set(recognized, decoder.decode(bytes));
    }

    return result;
}
