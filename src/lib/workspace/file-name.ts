import { FILE_EXTENSION } from "./fs-access";

const MAX_STEM_LENGTH = 100;
const FALLBACK_STEM = "resume";
// Characters Windows (the strictest platform) refuses in a file name, plus control characters.
const ILLEGAL = /[\\/:*?"<>|\u0000-\u001f\u007f]/g;
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export function sanitizeFileStem(input: string): string {
    let stem = input.replace(ILLEGAL, "").replace(/\s+/g, " ").trim();
    stem = stem.replace(/^[. ]+|[. ]+$/g, "");
    if (stem.length > MAX_STEM_LENGTH) stem = stem.slice(0, MAX_STEM_LENGTH).replace(/[. ]+$/g, "");
    if (!stem || RESERVED.test(stem)) return FALLBACK_STEM;
    return stem;
}

export function suggestedFileName(title: string): string {
    return `${sanitizeFileStem(title)}${FILE_EXTENSION}`;
}

/** The CV name a file name stands for: the name without `.enginecv.json` or `.json`. */
export function fileStemToTitle(fileName: string): string {
    const lower = fileName.toLowerCase();
    if (lower.endsWith(FILE_EXTENSION)) return fileName.slice(0, -FILE_EXTENSION.length);
    if (lower.endsWith(".json")) return fileName.slice(0, -".json".length);
    return fileName;
}
