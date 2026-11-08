import { zipSync } from "fflate";

/** Quote a CSV cell per RFC 4180 when it needs it. */
function csvCell(value: string): string {
    if (/[",\r\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

/** Build CSV text (CRLF, trailing newline) from a header row and data rows. */
export function csvFromRows(headers: string[], rows: Array<Record<string, string>>): string {
    const lines = [headers.map(csvCell).join(",")];
    for (const row of rows) {
        lines.push(headers.map((header) => csvCell(row[header] ?? "")).join(","));
    }
    return `${lines.join("\r\n")}\r\n`;
}

/** Zip named text entries into archive bytes. */
export function zipFromEntries(entries: Record<string, string>): Uint8Array {
    const encoder = new TextEncoder();
    const files: Record<string, Uint8Array> = {};
    for (const [name, text] of Object.entries(entries)) {
        files[name] = encoder.encode(text);
    }
    return zipSync(files);
}

/** Wrap bytes or text in a File as the drop zone would deliver it. */
export function fileFrom(content: Uint8Array | string, name: string): File {
    const part =
        typeof content === "string"
            ? new TextEncoder().encode(content)
            : content;
    // jsdom's File accepts BlobPart[]; copy into a fresh ArrayBuffer for safety.
    const buffer = new Uint8Array(part).buffer;
    return new File([buffer], name);
}

export function zipFileFromEntries(entries: Record<string, string>, name = "Basic_LinkedInDataExport.zip"): File {
    return fileFrom(zipFromEntries(entries), name);
}
