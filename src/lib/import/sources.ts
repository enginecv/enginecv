import { isAuthoringDocument, isJsonResumeDocument } from "@/lib/agent/authoring";
import { readFileBytes } from "./read-file";
import { isZipData } from "./linkedin/zip";

export type SourceKind = "file" | "paste" | "github";

export type SourceId = "enginecv" | "jsonresume" | "authoring" | "linkedin" | "europass" | "paste-ai" | "github";

export interface ImportSource {
    id: SourceId;
    labelKey: string;
    descriptionKey: string;
    needsNetwork: boolean;
    kind: SourceKind;
}

/** Every place the hub can bring data from, in the order it lists them. */
export const IMPORT_SOURCES: readonly ImportSource[] = [
    { id: "enginecv", labelKey: "importHub.source.enginecv", descriptionKey: "importHub.source.enginecv.desc", needsNetwork: false, kind: "file" },
    { id: "jsonresume", labelKey: "importHub.source.jsonresume", descriptionKey: "importHub.source.jsonresume.desc", needsNetwork: false, kind: "file" },
    { id: "linkedin", labelKey: "importHub.source.linkedin", descriptionKey: "importHub.source.linkedin.desc", needsNetwork: false, kind: "file" },
    { id: "europass", labelKey: "importHub.source.europass", descriptionKey: "importHub.source.europass.desc", needsNetwork: false, kind: "file" },
    { id: "authoring", labelKey: "importHub.source.authoring", descriptionKey: "importHub.source.authoring.desc", needsNetwork: false, kind: "file" },
    { id: "paste-ai", labelKey: "importHub.source.pasteAi", descriptionKey: "importHub.source.pasteAi.desc", needsNetwork: false, kind: "paste" },
    { id: "github", labelKey: "importHub.source.github", descriptionKey: "importHub.source.github.desc", needsNetwork: true, kind: "github" },
];

export function getImportSource(id: SourceId): ImportSource {
    const source = IMPORT_SOURCES.find((candidate) => candidate.id === id);
    if (!source) throw new Error(`Unknown import source: ${id}`);
    return source;
}

/** Text of a JSON-looking file, or null when it is not JSON. */
function parseJson(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

function lowerName(file: File): string {
    return file.name.toLowerCase();
}

/**
 * Decides which source a dropped file belongs to, by content first and name
 * second. Order: LinkedIn archive (zip or csv), Europass (pdf or xml), then
 * JSON: JSON Resume, authoring document, or an EngineCV file (plain,
 * encrypted or a data export). Returns null for anything else.
 */
export async function detectFileSource(file: File): Promise<SourceId | null> {
    const name = lowerName(file);

    if (name.endsWith(".csv")) return "linkedin";
    if (name.endsWith(".pdf") || name.endsWith(".xml")) return "europass";

    if (name.endsWith(".zip")) return "linkedin";
    if (!name.endsWith(".json") && !name.endsWith(".txt")) {
        // Wrong or missing extension: look at the first bytes.
        const head = await readFileBytes(file.slice(0, 8) as File);
        if (isZipData(head)) return "linkedin";
        if (head.length >= 4 && String.fromCharCode(...head.slice(0, 4)) === "%PDF") return "europass";
    }

    const text = new TextDecoder("utf-8", { fatal: false }).decode(await readFileBytes(file));
    const json = parseJson(text);
    if (json === null || typeof json !== "object" || Array.isArray(json)) return null;

    if (isJsonResumeDocument(json)) return "jsonresume";
    if (isAuthoringDocument(json)) return "authoring";
    return "enginecv";
}
