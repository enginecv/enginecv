import { readFileBytes } from "../read-file";
import { EuropassImportError } from "./errors";
import { extractEuropassXml, type EuropassSource } from "./extract";
import { isEmptyEuropassCv, parseEuropassXml, type ParsedEuropassCv } from "./parse";

/** Europass PDFs with a photo stay well under a few megabytes. */
export const MAX_EUROPASS_BYTES = 20 * 1024 * 1024;

export interface ParsedEuropassFile {
    cv: ParsedEuropassCv;
    source: EuropassSource;
    fileName: string;
}

/**
 * Reads a Europass CV file entirely in the browser. Failure classes surface
 * in a fixed order: too-large → unrecognized-file → no-europass-data /
 * corrupt-file.
 */
export async function parseEuropassFile(file: File): Promise<ParsedEuropassFile> {
    if (file.size > MAX_EUROPASS_BYTES) {
        throw new EuropassImportError("too-large");
    }

    let bytes: Uint8Array;
    try {
        bytes = await readFileBytes(file);
    } catch {
        throw new EuropassImportError("corrupt-file");
    }

    const { xml, source } = extractEuropassXml(bytes);
    const cv = parseEuropassXml(xml);
    if (isEmptyEuropassCv(cv)) {
        throw new EuropassImportError("no-europass-data");
    }

    return { cv, source, fileName: file.name };
}
