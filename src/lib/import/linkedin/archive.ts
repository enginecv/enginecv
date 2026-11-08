import { readFileBytes, readFileText } from "../read-file";
import { parseCsv, type ParsedCsv } from "./csv";
import { LinkedinImportError } from "./errors";
import { extractRecognizedEntries, isZipData, recognizedFileForName, RECOGNIZED_FILES, type RecognizedFile } from "./zip";

export const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

const YIELD_EVERY_ROWS = 2000;

export interface LinkedinProfile {
    firstName: string;
    lastName: string;
    headline: string;
    summary: string;
    industry: string;
    geoLocation: string;
    websites: string;
}

export interface LinkedinPosition {
    companyName: string;
    title: string;
    description: string;
    location: string;
    startedOn: string;
    finishedOn: string;
}

export interface LinkedinEducation {
    schoolName: string;
    degreeName: string;
    startDate: string;
    endDate: string;
    notes: string;
    activities: string;
}

export interface LinkedinSkill {
    name: string;
}

export interface LinkedinCertification {
    name: string;
    authority: string;
    url: string;
    startedOn: string;
    finishedOn: string;
    licenseNumber: string;
}

export interface LinkedinLanguage {
    name: string;
    proficiency: string;
}

export interface LinkedinProject {
    title: string;
    description: string;
    url: string;
    startedOn: string;
    finishedOn: string;
}

export interface ParsedLinkedinArchive {
    profile?: LinkedinProfile;
    positions: LinkedinPosition[];
    education: LinkedinEducation[];
    skills: LinkedinSkill[];
    certifications: LinkedinCertification[];
    languages: LinkedinLanguage[];
    projects: LinkedinProject[];
    filesFound: RecognizedFile[];
    filesMissing: RecognizedFile[];
    skippedRows: Partial<Record<RecognizedFile, number>>;
    ignoredInputs: string[];
}

const KNOWN_HEADERS: Record<RecognizedFile, string[]> = {
    profile: ["First Name", "Last Name", "Headline", "Summary", "Industry", "Geo Location", "Websites"],
    positions: ["Company Name", "Title", "Description", "Location", "Started On", "Finished On"],
    education: ["School Name", "Start Date", "End Date", "Notes", "Degree Name", "Activities"],
    skills: ["Name"],
    certifications: ["Name", "Url", "Authority", "Started On", "Finished On", "License Number"],
    languages: ["Name", "Proficiency"],
    projects: ["Title", "Description", "Url", "Started On", "Finished On"],
};

function hasHeaderOverlap(recognized: RecognizedFile, parsed: ParsedCsv): boolean {
    return KNOWN_HEADERS[recognized].some((header) => parsed.headers.includes(header));
}

let rowsSinceYield = 0;

async function yieldPerRows(count: number): Promise<void> {
    rowsSinceYield += count;
    if (rowsSinceYield >= YIELD_EVERY_ROWS) {
        rowsSinceYield = 0;
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
}

interface SectionResult {
    kept: number;
    skipped: number;
}

/**
 * Collect the recognized CSV texts from the supplied files. Failure classes
 * surface in a fixed order so each bad input maps to exactly one message:
 * too-large → unrecognized-file → corrupt-archive → no-profile-data.
 */
async function collectEntries(files: File[]): Promise<{ entries: Map<RecognizedFile, string>; ignoredInputs: string[] }> {
    if (files.length === 0) {
        throw new LinkedinImportError("no-profile-data");
    }

    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_IMPORT_BYTES) {
        throw new LinkedinImportError("too-large");
    }

    const ignoredInputs: string[] = [];
    const looksLikeCsv = (file: File) => /\.csv$/i.test(file.name);

    // Sniff each input: ZIPs identified by magic bytes, CSVs by extension.
    const zips: Array<{ file: File; bytes: Uint8Array }> = [];
    const csvs: File[] = [];
    for (const file of files) {
        if (looksLikeCsv(file)) {
            csvs.push(file);
            continue;
        }
        const bytes = await readFileBytes(file);
        if (isZipData(bytes)) {
            zips.push({ file, bytes });
        } else {
            throw new LinkedinImportError("unrecognized-file");
        }
    }

    if (zips.length > 0) {
        // First ZIP wins; every other input is disclosed as ignored.
        for (const extra of zips.slice(1)) ignoredInputs.push(extra.file.name);
        for (const csv of csvs) ignoredInputs.push(csv.name);

        const entries = extractRecognizedEntries(zips[0].bytes);
        if (entries.size === 0) {
            throw new LinkedinImportError("no-profile-data");
        }
        return { entries, ignoredInputs };
    }

    const entries = new Map<RecognizedFile, string>();
    for (const csv of csvs) {
        const recognized = recognizedFileForName(csv.name);
        if (!recognized || entries.has(recognized)) {
            ignoredInputs.push(csv.name);
            continue;
        }
        entries.set(recognized, await readFileText(csv));
    }

    if (entries.size === 0) {
        throw new LinkedinImportError("no-profile-data");
    }
    return { entries, ignoredInputs };
}

export async function parseLinkedinArchive(files: File[]): Promise<ParsedLinkedinArchive> {
    rowsSinceYield = 0;
    const { entries, ignoredInputs } = await collectEntries(files);

    const result: ParsedLinkedinArchive = {
        positions: [],
        education: [],
        skills: [],
        certifications: [],
        languages: [],
        projects: [],
        filesFound: [],
        filesMissing: [],
        skippedRows: {},
        ignoredInputs,
    };

    const markSkipped = (file: RecognizedFile, count: number) => {
        if (count > 0) {
            result.skippedRows[file] = (result.skippedRows[file] ?? 0) + count;
        }
    };

    for (const recognized of RECOGNIZED_FILES) {
        const text = entries.get(recognized);
        if (text === undefined) {
            result.filesMissing.push(recognized);
            continue;
        }

        let parsed: ParsedCsv;
        try {
            parsed = parseCsv(text);
        } catch {
            // Present but unreadable: disclosed as missing plus a skip marker.
            result.filesMissing.push(recognized);
            markSkipped(recognized, 1);
            continue;
        }

        if (parsed.headers.length === 0 || !hasHeaderOverlap(recognized, parsed)) {
            result.filesMissing.push(recognized);
            markSkipped(recognized, Math.max(parsed.rows.length, 1));
            continue;
        }

        const section = await parseSection(recognized, parsed, result);
        result.filesFound.push(recognized);
        markSkipped(recognized, section.skipped);
    }

    return result;
}

async function parseSection(
    recognized: RecognizedFile,
    parsed: ParsedCsv,
    result: ParsedLinkedinArchive,
): Promise<SectionResult> {
    let kept = 0;
    let skipped = 0;

    const keepIf = (usable: boolean, push: () => void) => {
        if (usable) {
            push();
            kept += 1;
        } else {
            skipped += 1;
        }
    };

    switch (recognized) {
        case "profile": {
            const [first, ...extras] = parsed.rows;
            if (first) {
                result.profile = {
                    firstName: (first["First Name"] ?? "").trim(),
                    lastName: (first["Last Name"] ?? "").trim(),
                    headline: (first["Headline"] ?? "").trim(),
                    summary: (first["Summary"] ?? "").trim(),
                    industry: (first["Industry"] ?? "").trim(),
                    geoLocation: (first["Geo Location"] ?? "").trim(),
                    websites: (first["Websites"] ?? "").trim(),
                };
                kept = 1;
            }
            skipped = extras.length;
            break;
        }
        case "positions":
            for (const row of parsed.rows) {
                const companyName = (row["Company Name"] ?? "").trim();
                const title = (row["Title"] ?? "").trim();
                keepIf(companyName !== "" || title !== "", () =>
                    result.positions.push({
                        companyName,
                        title,
                        description: (row["Description"] ?? "").trim(),
                        location: (row["Location"] ?? "").trim(),
                        startedOn: (row["Started On"] ?? "").trim(),
                        finishedOn: (row["Finished On"] ?? "").trim(),
                    }),
                );
                await yieldPerRows(1);
            }
            break;
        case "education":
            for (const row of parsed.rows) {
                const schoolName = (row["School Name"] ?? "").trim();
                const degreeName = (row["Degree Name"] ?? "").trim();
                keepIf(schoolName !== "" || degreeName !== "", () =>
                    result.education.push({
                        schoolName,
                        degreeName,
                        startDate: (row["Start Date"] ?? "").trim(),
                        endDate: (row["End Date"] ?? "").trim(),
                        notes: (row["Notes"] ?? "").trim(),
                        activities: (row["Activities"] ?? "").trim(),
                    }),
                );
                await yieldPerRows(1);
            }
            break;
        case "skills":
            for (const row of parsed.rows) {
                const name = (row["Name"] ?? "").trim();
                keepIf(name !== "", () => result.skills.push({ name }));
                await yieldPerRows(1);
            }
            break;
        case "certifications":
            for (const row of parsed.rows) {
                const name = (row["Name"] ?? "").trim();
                keepIf(name !== "", () =>
                    result.certifications.push({
                        name,
                        authority: (row["Authority"] ?? "").trim(),
                        url: (row["Url"] ?? "").trim(),
                        startedOn: (row["Started On"] ?? "").trim(),
                        finishedOn: (row["Finished On"] ?? "").trim(),
                        licenseNumber: (row["License Number"] ?? "").trim(),
                    }),
                );
                await yieldPerRows(1);
            }
            break;
        case "languages":
            for (const row of parsed.rows) {
                const name = (row["Name"] ?? "").trim();
                keepIf(name !== "", () =>
                    result.languages.push({
                        name,
                        proficiency: (row["Proficiency"] ?? "").trim(),
                    }),
                );
                await yieldPerRows(1);
            }
            break;
        case "projects":
            for (const row of parsed.rows) {
                const title = (row["Title"] ?? "").trim();
                keepIf(title !== "", () =>
                    result.projects.push({
                        title,
                        description: (row["Description"] ?? "").trim(),
                        url: (row["Url"] ?? "").trim(),
                        startedOn: (row["Started On"] ?? "").trim(),
                        finishedOn: (row["Finished On"] ?? "").trim(),
                    }),
                );
                await yieldPerRows(1);
            }
            break;
    }

    return { kept, skipped };
}
