export class CsvParseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CsvParseError";
    }
}

export interface ParsedCsv {
    headers: string[];
    rows: Array<Record<string, string>>;
}

/**
 * RFC 4180 parser for LinkedIn export CSVs: quoted fields may contain commas,
 * newlines, and doubled quotes; lines end with CRLF or LF; the first record
 * is the header row. Cells map by header name; short rows pad with "", extra
 * cells are dropped. Throws CsvParseError on an unterminated quote at EOF.
 */
export function parseCsv(text: string): ParsedCsv {
    const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

    const records: string[][] = [];
    let record: string[] = [];
    let cell = "";
    let inQuotes = false;
    let cellStarted = false;

    const endCell = () => {
        record.push(cell);
        cell = "";
        cellStarted = false;
    };
    const endRecord = () => {
        endCell();
        records.push(record);
        record = [];
    };

    for (let i = 0; i < input.length; i += 1) {
        const char = input[i];

        if (inQuotes) {
            if (char === '"') {
                if (input[i + 1] === '"') {
                    cell += '"';
                    i += 1;
                } else {
                    inQuotes = false;
                }
            } else {
                cell += char;
            }
            continue;
        }

        if (char === '"' && !cellStarted) {
            inQuotes = true;
            cellStarted = true;
            continue;
        }

        if (char === ",") {
            endCell();
            continue;
        }

        if (char === "\r" && input[i + 1] === "\n") {
            endRecord();
            i += 1;
            continue;
        }

        if (char === "\n" || char === "\r") {
            endRecord();
            continue;
        }

        cell += char;
        cellStarted = true;
    }

    if (inQuotes) {
        throw new CsvParseError("Unterminated quoted field at end of input");
    }
    if (cell !== "" || record.length > 0) {
        endRecord();
    }

    const nonEmpty = records.filter((cells) => cells.some((value) => value !== ""));
    if (nonEmpty.length === 0) {
        return { headers: [], rows: [] };
    }

    const headers = nonEmpty[0];
    const rows = nonEmpty.slice(1).map((cells) => {
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
            row[header] = cells[index] ?? "";
        });
        return row;
    });

    return { headers, rows };
}
