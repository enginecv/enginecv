import GithubSlugger from "github-slugger";
import { z } from "zod";

export const changelogEntrySchema = z.object({
    markdown: z.string().min(1),
});

export const changelogGroupSchema = z.object({
    category: z.string().min(1),
    entries: z.array(changelogEntrySchema).min(1),
});

export const changelogSectionSchema = z.object({
    date: z.string(),
    slug: z.string().min(1),
    groups: z.array(changelogGroupSchema).min(1),
});

export const changelogSchema = z.object({
    unreleased: changelogSectionSchema.nullable(),
    sections: z.array(changelogSectionSchema).min(1),
});

export type ChangelogEntry = z.infer<typeof changelogEntrySchema>;
export type ChangelogGroup = z.infer<typeof changelogGroupSchema>;
export type ChangelogSection = z.infer<typeof changelogSectionSchema>;
export type Changelog = z.infer<typeof changelogSchema>;

export class ChangelogParseError extends Error {
    line: number | null;
    section: string | null;

    constructor(message: string, line: number | null = null, section: string | null = null) {
        super(message);
        this.name = "ChangelogParseError";
        this.line = line;
        this.section = section;
    }
}

const KNOWN_CATEGORIES = new Set([
    "Added",
    "Changed",
    "Deprecated",
    "Removed",
    "Fixed",
    "Security",
    "Thanks",
]);

const SECTION_HEADING = /^##\s+\[([^\]]+)\]\s*$/;
const GROUP_HEADING = /^###\s+(.+?)\s*$/;
const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(date: string): boolean {
    const [year, month, day] = date.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));

    return (
        parsed.getUTCFullYear() === year &&
        parsed.getUTCMonth() === month - 1 &&
        parsed.getUTCDate() === day
    );
}

function todayIsoDate(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${now.getFullYear()}-${month}-${day}`;
}

interface MutableSection {
    date: string;
    slug: string;
    groups: ChangelogGroup[];
    headingLine: number;
}

export function parseChangelog(source: string): Changelog {
    if (source.trim().length === 0) {
        throw new ChangelogParseError("CHANGELOG is empty; at least one dated section is required");
    }

    const slugger = new GithubSlugger();
    const today = todayIsoDate();
    const lines = source.split(/\r?\n/);

    let unreleased: ChangelogSection | null = null;
    const sections: ChangelogSection[] = [];

    let currentSection: MutableSection | null = null;
    let currentGroup: ChangelogGroup | null = null;
    let currentEntry: string[] = [];
    let previousDate: string | null = null;

    const sectionLabel = () => currentSection?.date ?? null;

    const finishEntry = () => {
        if (currentEntry.length === 0) return;
        const markdown = currentEntry.join(" ").trim();
        currentEntry = [];
        if (markdown.length === 0) return;
        currentGroup?.entries.push({ markdown });
    };

    const finishGroup = (line: number) => {
        finishEntry();
        if (currentGroup && currentGroup.entries.length === 0) {
            throw new ChangelogParseError(
                `Category group "${currentGroup.category}" has no entries`,
                line,
                sectionLabel(),
            );
        }
        currentGroup = null;
    };

    const finishSection = (line: number) => {
        if (!currentSection) return;
        finishGroup(line);
        if (currentSection.groups.length === 0) {
            throw new ChangelogParseError(
                `Section [${currentSection.date}] has no category groups`,
                currentSection.headingLine,
                currentSection.date,
            );
        }
        const finished: ChangelogSection = {
            date: currentSection.date,
            slug: currentSection.slug,
            groups: currentSection.groups,
        };
        if (finished.date === "Unreleased") {
            unreleased = finished;
        } else {
            sections.push(finished);
        }
        currentSection = null;
    };

    for (let index = 0; index < lines.length; index += 1) {
        const lineNumber = index + 1;
        const line = lines[index];
        const trimmed = line.trim();

        if (trimmed.startsWith("## ") || trimmed === "##") {
            const match = trimmed.match(SECTION_HEADING);
            if (!match) {
                throw new ChangelogParseError(
                    `Malformed section heading "${trimmed}"; expected "## [YYYY-MM-DD]" or "## [Unreleased]"`,
                    lineNumber,
                    sectionLabel(),
                );
            }

            finishSection(lineNumber);
            const label = match[1];

            if (label === "Unreleased") {
                if (unreleased) {
                    throw new ChangelogParseError(
                        "Duplicate [Unreleased] section",
                        lineNumber,
                        "Unreleased",
                    );
                }
                if (sections.length > 0) {
                    throw new ChangelogParseError(
                        "[Unreleased] must appear before all dated sections",
                        lineNumber,
                        "Unreleased",
                    );
                }
                currentSection = {
                    date: "Unreleased",
                    slug: slugger.slug("unreleased"),
                    groups: [],
                    headingLine: lineNumber,
                };
                continue;
            }

            if (!DATE_FORMAT.test(label) || !isRealDate(label)) {
                throw new ChangelogParseError(
                    `Section heading date "${label}" is not a real YYYY-MM-DD calendar date`,
                    lineNumber,
                    label,
                );
            }
            if (label > today) {
                throw new ChangelogParseError(
                    `Section date "${label}" is in the future (today is ${today})`,
                    lineNumber,
                    label,
                );
            }
            if (previousDate !== null && label > previousDate) {
                throw new ChangelogParseError(
                    `Section [${label}] is out of reverse-chronological order (appears after [${previousDate}])`,
                    lineNumber,
                    label,
                );
            }

            previousDate = label;
            currentSection = {
                date: label,
                slug: slugger.slug(label),
                groups: [],
                headingLine: lineNumber,
            };
            continue;
        }

        if (trimmed.startsWith("### ")) {
            if (!currentSection) {
                throw new ChangelogParseError(
                    `Category heading "${trimmed}" appears outside any section`,
                    lineNumber,
                );
            }
            finishGroup(lineNumber);
            const category = trimmed.match(GROUP_HEADING)![1];
            if (!KNOWN_CATEGORIES.has(category)) {
                console.warn(
                    `CHANGELOG: unknown category "${category}" (line ${lineNumber}); rendered verbatim — check for typos`,
                );
            }
            currentGroup = { category, entries: [] };
            currentSection.groups.push(currentGroup);
            continue;
        }

        if (!currentSection) {
            // Preamble (title, intro prose) before the first section is ignored.
            continue;
        }

        if (trimmed.length === 0) {
            finishEntry();
            continue;
        }

        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            if (!currentGroup) {
                throw new ChangelogParseError(
                    `Entry "${trimmed}" appears directly under section [${currentSection.date}] without a "###" category group`,
                    lineNumber,
                    currentSection.date,
                );
            }
            finishEntry();
            currentEntry.push(trimmed.slice(2).trim());
            continue;
        }

        if (currentGroup && currentEntry.length > 0) {
            currentEntry.push(trimmed);
            continue;
        }

        throw new ChangelogParseError(
            `Content "${trimmed}" appears directly under section [${currentSection.date}] without a "###" category group`,
            lineNumber,
            currentSection.date,
        );
    }

    finishSection(lines.length);

    if (sections.length === 0) {
        throw new ChangelogParseError(
            "CHANGELOG contains no dated sections; at least one \"## [YYYY-MM-DD]\" section is required",
        );
    }

    return changelogSchema.parse({ unreleased, sections });
}
