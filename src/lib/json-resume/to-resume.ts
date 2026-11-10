import { normaliseLink, normaliseSkillLevel, parseLanguageLevel } from "@/lib/agent/authoring/values";
import { createEmptyResume, createUngroupedSkillGroup, resumeSchema, type Resume } from "@/lib/schema";
import { createNewResume } from "@/lib/templates/default-design";
import { importDate } from "./dates";
import { IMPORT_SECTION_ORDER, SECTION_MAPS, type SectionMap } from "./mapping";
import { addLoss, emptyReport, type ConversionReport } from "./report";
import { JSON_RESUME_KEYS } from "./schema";

type Obj = Record<string, unknown>;

export interface JsonResumeImportResult {
    /** `resumeSchema`-valid, no id yet. */
    resume: Resume;
    report: ConversionReport;
    /** Entries imported per EngineCV section (skills counts individual skills). */
    counts: Record<string, number>;
}

const SAFE_LINK_SCHEME = /^(?:https?|mailto|tel):/i;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function isObj(value: unknown): value is Obj {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A string field; numbers are accepted as text, everything else is "not given". */
function str(value: unknown): string {
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return "";
}

function strList(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map(str).filter(Boolean);
}

/** A web address with a scheme we link to, or a bare domain made into https. */
function safeLink(raw: unknown): { value: string; dropped: boolean } {
    const text = str(raw);
    if (!text) return { value: "", dropped: false };
    if (HAS_SCHEME.test(text)) return SAFE_LINK_SCHEME.test(text) ? { value: text, dropped: false } : { value: "", dropped: true };
    return { value: normaliseLink(text).value, dropped: false };
}

function countryName(code: string): string {
    if (!code) return "";
    try {
        return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code;
    } catch {
        return code;
    }
}

/** The display text for a structured address; also used by export to detect an edited location. */
export function buildLocationText(parts: { address?: string; city?: string; region?: string; countryCode?: string }): string {
    const joined = [parts.city, parts.region, countryName(parts.countryCode ?? "")].filter(Boolean).join(", ");
    return joined || parts.address || "";
}

class Converter {
    report = emptyReport();
    counts: Record<string, number> = {};

    private skipped(section: string, count = 1) {
        addLoss(this.report, "left-out", "invalid-values-skipped", section, count);
    }

    private date(raw: unknown, section: string): string {
        const date = importDate(raw);
        if (date.dayDropped) addLoss(this.report, "changed", "date-day-dropped", section, 1);
        if (date.unreadable) this.skipped(section);
        return date.value;
    }

    private link(raw: unknown, section: string): string {
        const link = safeLink(raw);
        if (link.dropped) this.skipped(section);
        return link.value;
    }

    basics(value: unknown): { basics: Obj; links: Obj[] } {
        const input = isObj(value) ? value : {};
        const basics: Obj = {
            name: str(input.name),
            headline: str(input.label),
            email: str(input.email),
            phone: str(input.phone),
            website: this.link(input.url, "basics"),
            summary: str(input.summary),
        };

        const image = str(input.image);
        if (image.startsWith("data:image/")) basics.photo = image;
        else if (image) addLoss(this.report, "left-out", "photo-url-not-fetched", "basics", 1);

        if (isObj(input.location)) {
            const parts = {
                address: str(input.location.address),
                postalCode: str(input.location.postalCode),
                city: str(input.location.city),
                region: str(input.location.region),
                countryCode: str(input.location.countryCode).toUpperCase(),
            };
            basics.locationParts = parts;
            basics.location = buildLocationText(parts);
        }

        const links: Obj[] = [];
        if (Array.isArray(input.profiles)) {
            for (const profile of input.profiles) {
                if (!isObj(profile)) continue;
                const network = str(profile.network);
                const username = str(profile.username);
                const url = this.link(profile.url, "basics");
                const key = network.toLowerCase();
                if (key === "linkedin") {
                    basics.linkedin = url || (username ? `https://www.linkedin.com/in/${username}` : "");
                } else if (key === "github") {
                    basics.github = url || (username ? `https://github.com/${username}` : "");
                } else if (network && (url || username)) {
                    links.push({ name: network, url, label: username, icon: "auto" });
                }
            }
        }
        basics.customLinks = links;
        return { basics, links };
    }

    /** Copies one entry through its section map; null when the entry is empty. */
    private entry(source: unknown, map: SectionMap): Obj | null {
        if (!isObj(source)) {
            this.skipped(map.engine);
            return null;
        }
        const entry: Obj = {};
        let hasContent = false;

        for (const [from, to] of map.text) {
            const value = from === "url" ? this.link(source[from], map.engine) : str(source[from]);
            if (value) hasContent = true;
            entry[to] = value;
        }
        for (const [from, to] of map.lists) {
            const list = strList(source[from]);
            if (list.length > 0) hasContent = true;
            entry[to] = list;
        }
        for (const [from, to] of map.dates) {
            const value = this.date(source[from], map.engine);
            if (value) hasContent = true;
            entry[to] = value;
        }
        if (!hasContent) {
            addLoss(this.report, "left-out", "empty-entries-skipped", map.engine, 1);
            return null;
        }
        if (map.currentWithoutEnd && entry.start && !entry.end) entry.end = "Present";
        return entry;
    }

    section(source: unknown, map: SectionMap): Obj[] {
        if (!Array.isArray(source)) return [];
        const entries: Obj[] = [];
        for (const raw of source) {
            const entry = this.entry(raw, map);
            if (!entry) continue;
            this.sectionSpecifics(raw as Obj, entry, map);
            entries.push(entry);
        }
        this.counts[map.engine] = entries.length;
        return entries;
    }

    /** What a plain copy cannot do: fold text, report fields with no home. */
    private sectionSpecifics(raw: Obj, entry: Obj, map: SectionMap) {
        if (map.engine === "experience" && str(raw.description)) {
            addLoss(this.report, "left-out", "company-description-left-out", "experience", 1);
        }
        if (map.engine === "organisations") {
            const highlights = strList(raw.highlights);
            if (highlights.length > 0) {
                const bullets = highlights.map((item) => `- ${item}`).join("\n");
                entry.description = entry.description ? `${entry.description as string}\n\n${bullets}` : bullets;
                addLoss(this.report, "changed", "volunteer-highlights-folded", "organisations", 1);
            }
        }
        if (map.engine === "projects") {
            if (strList(raw.roles).length > 0) addLoss(this.report, "left-out", "project-roles-left-out", "projects", 1);
            if (str(raw.type)) addLoss(this.report, "left-out", "project-type-left-out", "projects", 1);
        }
        if (map.engine === "interests") {
            const keywords = strList(raw.keywords);
            if (keywords.length > 0) {
                entry.description = keywords.join(", ");
                addLoss(this.report, "changed", "interest-keywords-folded", "interests", 1);
            }
        }
        if (map.engine === "languages") {
            entry.fluency = parseLanguageLevel(str(raw.fluency)).value;
        }
    }

    skills(source: unknown): Obj[] {
        if (!Array.isArray(source)) return [];
        const skills: Obj[] = [];
        for (const raw of source) {
            if (!isObj(raw)) {
                this.skipped("skills");
                continue;
            }
            const name = str(raw.name);
            const keywords = strList(raw.keywords);
            if (!name && keywords.length === 0) {
                addLoss(this.report, "left-out", "empty-entries-skipped", "skills", 1);
                continue;
            }
            const rawLevel = str(raw.level);
            const level = normaliseSkillLevel(rawLevel);
            const skill: Obj = { name: name || keywords[0], level: level.value, keywords: name ? keywords : keywords.slice(1) };
            if (rawLevel && level.value && level.value !== rawLevel.toLowerCase()) {
                addLoss(this.report, "changed", "skill-level-adjusted", "skills", 1);
            }
            if (rawLevel && !level.value) {
                skill.description = rawLevel;
                addLoss(this.report, "changed", "skill-level-kept-as-text", "skills", 1);
            }
            skills.push(skill);
        }
        this.counts.skills = skills.length;
        return skills;
    }
}

function emptyOutcome(report: ConversionReport): JsonResumeImportResult {
    return { resume: createEmptyResume(), report, counts: {} };
}

/** JSON Resume v1.0.0 to an EngineCV CV, plus a report of what did not carry over. */
export function jsonResumeToResume(document: unknown, options: { now?: number } = {}): JsonResumeImportResult {
    const now = options.now ?? Date.now();
    const convert = new Converter();
    const report = convert.report;

    if (!isObj(document)) {
        addLoss(report, "left-out", "invalid-values-skipped", "", 1);
        return emptyOutcome(report);
    }

    const unknownKeys = Object.keys(document).filter((key) => !(JSON_RESUME_KEYS as readonly string[]).includes(key));
    if (unknownKeys.length > 0) addLoss(report, "left-out", "unknown-keys-ignored", "", unknownKeys.length);
    if (isObj(document.meta) && str(document.meta.theme)) addLoss(report, "left-out", "theme-left-out", "", 1);

    const { basics } = convert.basics(document.basics);
    const resume: Obj = { basics };
    for (const map of SECTION_MAPS) {
        const entries = convert.section(document[map.jr], map);
        if (entries.length > 0) resume[map.engine] = entries;
    }
    const skills = convert.skills(document.skills);
    if (skills.length > 0) resume.skillGroups = [createUngroupedSkillGroup(skills as never)];

    const contentSections = IMPORT_SECTION_ORDER.filter((key) => (convert.counts[key] ?? 0) > 0);
    const base = createNewResume();
    const name = typeof basics.name === "string" ? basics.name : "";

    const parsed = resumeSchema.safeParse({
        ...resume,
        id: undefined,
        createdAt: now,
        updatedAt: now,
        meta: { ...base.meta, title: name },
        settings: {
            ...base.settings,
            contentSections,
            layout: { ...base.settings.layout, sectionOrder: contentSections },
        },
    });

    if (!parsed.success) {
        // Every value above is typed before it lands here; this is a safety net.
        addLoss(report, "left-out", "invalid-values-skipped", "", 1);
        return emptyOutcome(report);
    }
    return { resume: parsed.data, report, counts: convert.counts };
}
