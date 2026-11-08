import { inflateSync, unzlibSync } from "fflate";
import { EuropassImportError } from "./errors";

export type EuropassSource = "pdf" | "xml";

export interface ExtractedEuropassXml {
    xml: string;
    source: EuropassSource;
}

const EUROPASS_ROOT = /<(?:[\w.-]+:)?(?:Candidate|SkillsPassport)[\s>/]/;

export function isPdfData(data: Uint8Array): boolean {
    // "%PDF" may follow a few junk bytes; the spec tolerates up to 1024.
    const head = latin1(data.subarray(0, 1024));
    return head.includes("%PDF-");
}

function latin1(data: Uint8Array): string {
    // One char per byte, so string offsets double as byte offsets.
    let result = "";
    const chunk = 0x8000;
    for (let offset = 0; offset < data.length; offset += chunk) {
        result += String.fromCharCode(...data.subarray(offset, offset + chunk));
    }
    return result;
}

export function decodeXmlText(data: Uint8Array): string {
    if (data.length >= 2 && data[0] === 0xff && data[1] === 0xfe) {
        return new TextDecoder("utf-16le").decode(data.subarray(2));
    }
    if (data.length >= 2 && data[0] === 0xfe && data[1] === 0xff) {
        return new TextDecoder("utf-16be").decode(data.subarray(2));
    }
    return new TextDecoder("utf-8", { fatal: false }).decode(data).replace(/^\uFEFF/, "");
}

export function looksLikeEuropassXml(text: string): boolean {
    return EUROPASS_ROOT.test(text.slice(0, 4096));
}

interface PdfStream {
    dictionary: string;
    data: Uint8Array;
}

/**
 * Walks every `stream … endstream` body in the file. Stream objects can never
 * live inside compressed object streams, so their dictionaries are always
 * readable here even in PDF 1.5+ files. `/Length` is often an indirect
 * reference, so the body is delimited by the `endstream` keyword instead.
 */
function* pdfStreams(data: Uint8Array, text: string): Generator<PdfStream> {
    const keyword = /\bstream(\r\n|\n|\r)/g;
    let match: RegExpExecArray | null;

    while ((match = keyword.exec(text)) !== null) {
        const bodyStart = match.index + match[0].length;
        const bodyEnd = text.indexOf("endstream", bodyStart);
        if (bodyEnd === -1) return;

        const objStart = text.lastIndexOf(" obj", match.index);
        const dictionary = text.slice(objStart === -1 ? Math.max(0, match.index - 512) : objStart, match.index);

        let end = bodyEnd;
        if (text[end - 1] === "\n") end -= 1;
        if (text[end - 1] === "\r") end -= 1;

        yield { dictionary, data: data.subarray(bodyStart, end) };
        keyword.lastIndex = bodyEnd + "endstream".length;
    }
}

function decodeStream(stream: PdfStream): Uint8Array | null {
    // `/Filter /FlateDecode` or `/Filter [/FlateDecode]`. Only the value is
    // captured, never the next key (Europass writes `/Length` right after it).
    const filterMatch = /\/Filter\s*(?:\[([^\]]*)\]|(\/[A-Za-z0-9]+))/.exec(stream.dictionary);
    const filters = (filterMatch?.[1] ?? filterMatch?.[2] ?? "").split(/\s+/).filter(Boolean);

    if (filters.length === 0) return stream.data;
    if (filters.length === 1 && filters[0] === "/FlateDecode") {
        try {
            return unzlibSync(stream.data);
        } catch {
            try {
                return inflateSync(stream.data);
            } catch {
                return null;
            }
        }
    }
    // Other filters never carry Europass XML in practice.
    return null;
}

function xmlFromStreams(streams: PdfStream[]): string | null {
    for (const stream of streams) {
        const decoded = decodeStream(stream);
        if (!decoded) continue;
        const text = decodeXmlText(decoded);
        if (looksLikeEuropassXml(text)) return text;
    }
    return null;
}

/**
 * Europass PDFs carry the CV as an embedded XML file attachment. Embedded file
 * streams are tried first; any other non-image stream is the fallback for
 * generators that omit the optional `/Type /EmbeddedFile` marker.
 */
export function extractXmlFromPdf(data: Uint8Array): string {
    const text = latin1(data);
    const streams = Array.from(pdfStreams(data, text));
    const embedded = streams.filter((stream) => /\/EmbeddedFile\b/.test(stream.dictionary));

    const xml = xmlFromStreams(embedded)
        ?? xmlFromStreams(streams.filter((stream) => !embedded.includes(stream) && !/\/Subtype\s*\/Image\b/.test(stream.dictionary)));

    if (!xml) throw new EuropassImportError("no-europass-data");
    return xml;
}

export function extractEuropassXml(data: Uint8Array): ExtractedEuropassXml {
    if (isPdfData(data)) {
        return { xml: extractXmlFromPdf(data), source: "pdf" };
    }

    const text = decodeXmlText(data);
    if (!text.trimStart().startsWith("<")) {
        throw new EuropassImportError("unrecognized-file");
    }
    if (!looksLikeEuropassXml(text)) {
        throw new EuropassImportError("no-europass-data");
    }
    return { xml: text, source: "xml" };
}
