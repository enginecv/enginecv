import type { Resume } from "@/lib/schema";
import { exportDate } from "./dates";
import { SECTION_MAPS, type EngineSection, type SectionMap } from "./mapping";
import { addLoss, emptyReport, type ConversionReport } from "./report";
import { JSON_RESUME_VERSION } from "./schema";
import { buildLocationText } from "./to-resume";

type Obj = Record<string, unknown>;

export interface JsonResumeExportOptions {
    /** Write the stored photo into `basics.image`. Off by default. */
    includePhoto?: boolean;
    /** For `meta.lastModified`; defaults to now. */
    now?: Date;
}

export interface JsonResumeExportResult {
    document: Obj;
    report: ConversionReport;
}

const PERSONAL_DETAIL_FIELDS = [
    "dateOfBirth", "nationality", "passportOrId", "passport", "nationalId", "maritalStatus",
    "militaryService", "genderPronoun", "disability", "visa", "height", "drivingLicense",
] as const;

/** Values the editor stores as defaults, not as something the person entered. */
const DEFAULT_MARKERS = new Set(["", "none", "auto"]);

function meaningful(value: unknown): boolean {
    if (typeof value === "string") return !DEFAULT_MARKERS.has(value.trim());
    if (Array.isArray(value)) return value.length > 0;
    return false;
}

function set(target: Obj, key: string, value: unknown) {
    if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) return;
    target[key] = value;
}

function lastSegment(url: string): string {
    const clean = url.split(/[?#]/)[0].replace(/\/+$/, "");
    return clean.slice(clean.lastIndexOf("/") + 1);
}

function capitalise(word: string): string {
    return word ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}

/**
 * Volunteer entries keep their bullets in the description (import folds them in).
 * A trailing "- item" list goes back to `highlights` so a round trip is stable.
 */
function splitTrailingBullets(entry: Obj) {
    const summary = typeof entry.summary === "string" ? entry.summary : "";
    const lines = summary.split("\n");
    const bullets: string[] = [];
    while (lines.length > 0 && /^- \S/.test(lines[lines.length - 1])) bullets.unshift(lines.pop()!.slice(2).trim());
    if (bullets.length === 0) return;
    const text = lines.join("\n").trim();
    if (text) entry.summary = text;
    else delete entry.summary;
    entry.highlights = bullets;
}

class Exporter {
    report = emptyReport();

    constructor(private readonly resume: Resume, private readonly options: JsonResumeExportOptions) {}

    private shown(section: string): boolean {
        const { contentSections, hiddenSections } = this.resume.settings;
        return contentSections.includes(section) && !hiddenSections.includes(section);
    }

    basics(): Obj {
        const { basics } = this.resume;
        const out: Obj = {};
        set(out, "name", basics.name);
        set(out, "label", basics.headline);
        set(out, "email", basics.email);
        set(out, "phone", basics.phone);
        set(out, "url", basics.website);
        set(out, "summary", basics.summary);

        if (basics.photo) {
            if (this.options.includePhoto) out.image = basics.photo;
            else addLoss(this.report, "left-out", "photo-left-out", "basics", 1);
        }

        const parts = basics.locationParts;
        const hasParts = Object.values(parts).some(Boolean);
        if (hasParts && basics.location === buildLocationText(parts)) {
            const location: Obj = {};
            set(location, "address", parts.address);
            set(location, "postalCode", parts.postalCode);
            set(location, "city", parts.city);
            set(location, "region", parts.region);
            set(location, "countryCode", parts.countryCode);
            out.location = location;
        } else if (basics.location) {
            out.location = { city: basics.location };
            if (hasParts) addLoss(this.report, "changed", "location-parts-simplified", "basics", 1);
        }

        const profiles: Obj[] = [];
        if (basics.linkedin) profiles.push({ network: "LinkedIn", username: lastSegment(basics.linkedin), url: basics.linkedin });
        if (basics.github) profiles.push({ network: "GitHub", username: lastSegment(basics.github), url: basics.github });
        for (const link of basics.customLinks) {
            if (!link.name && !link.url) continue;
            const profile: Obj = {};
            set(profile, "network", link.name);
            set(profile, "username", link.label);
            set(profile, "url", link.url);
            profiles.push(profile);
        }
        if (profiles.length > 0) out.profiles = profiles;

        const personal = PERSONAL_DETAIL_FIELDS.filter((field) => Boolean(basics[field])).length;
        if (personal > 0) addLoss(this.report, "left-out", "personal-details-left-out", "basics", personal);
        return out;
    }

    private entry(source: Obj, map: SectionMap): Obj {
        const out: Obj = {};
        for (const [to, from] of map.text) set(out, to, source[from]);
        for (const [to, from] of map.lists) set(out, to, source[from]);
        for (const [to, from] of map.dates) {
            const date = exportDate(source[from] as string | undefined);
            if (date.unparsed) addLoss(this.report, "left-out", "dates-unparsed-left-out", map.engine, 1);
            set(out, to, date.value);
        }
        return out;
    }

    section(map: SectionMap): Obj[] {
        const entries = (this.resume[map.engine as keyof Resume] as Obj[] | undefined) ?? [];
        if (entries.length === 0) return [];
        const shown = this.shown(map.engine);
        const visible = shown ? entries.filter((entry) => !entry.hidden) : [];
        const hidden = entries.length - visible.length;
        if (hidden > 0) addLoss(this.report, "left-out", "hidden-entries-left-out", map.engine, hidden);

        const out: Obj[] = [];
        let withExtras = 0;
        let withCefr = 0;
        for (const source of visible) {
            const entry = this.entry(source, map);
            if (map.engine === "organisations") splitTrailingBullets(entry);
            if (map.extras.some((field) => meaningful(source[field]))) withExtras += 1;
            if (map.engine === "languages" && source.cefrDetailed === true) withCefr += 1;
            if (Object.keys(entry).length > 0) out.push(entry);
        }
        if (withExtras > 0) addLoss(this.report, "left-out", "entry-extras-left-out", map.engine, withExtras);
        if (withCefr > 0) addLoss(this.report, "left-out", "language-details-left-out", "languages", withCefr);
        return out;
    }

    skills(): Obj[] {
        const groups = this.resume.skillGroups;
        const total = groups.reduce((sum, group) => sum + group.skills.length, 0);
        if (total === 0) return [];
        const shown = this.shown("skills");
        const out: Obj[] = [];
        let visibleCount = 0;
        let namedGroups = 0;
        let withExtras = 0;
        for (const group of groups) {
            if (!shown || group.hidden) continue;
            let groupHasSkill = false;
            for (const skill of group.skills) {
                if (skill.hidden) continue;
                visibleCount += 1;
                groupHasSkill = true;
                const entry: Obj = {};
                set(entry, "name", skill.name);
                set(entry, "level", capitalise(skill.level));
                set(entry, "keywords", skill.keywords);
                if (meaningful(skill.description)) withExtras += 1;
                if (Object.keys(entry).length > 0) out.push(entry);
            }
            if (group.name && groupHasSkill) namedGroups += 1;
        }
        if (total - visibleCount > 0) addLoss(this.report, "left-out", "hidden-entries-left-out", "skills", total - visibleCount);
        if (namedGroups > 0) addLoss(this.report, "changed", "skill-groups-flattened", "skills", namedGroups);
        if (withExtras > 0) addLoss(this.report, "left-out", "entry-extras-left-out", "skills", withExtras);
        return out;
    }

    leftOutSections() {
        const { courses, customSections, declaration, coverLetters } = this.resume;
        const shownCourses = this.shown("courses");
        const visibleCourses = shownCourses ? courses.filter((course) => !course.hidden) : [];
        if (visibleCourses.length > 0) addLoss(this.report, "left-out", "courses-section-left-out", "courses", visibleCourses.length);
        if (courses.length - visibleCourses.length > 0) {
            addLoss(this.report, "left-out", "hidden-entries-left-out", "courses", courses.length - visibleCourses.length);
        }
        const shownCustom = customSections.filter((section) => this.shown(`custom:${section.id}`));
        if (shownCustom.length > 0) addLoss(this.report, "left-out", "custom-sections-left-out", "custom", shownCustom.length);
        if (this.shown("declaration") && declaration.some((item) => !item.hidden && (item.text || item.fullName || item.signature))) {
            addLoss(this.report, "left-out", "declaration-left-out", "declaration", 1);
        }
        if (coverLetters.length > 0) addLoss(this.report, "left-out", "cover-letters-left-out", "", coverLetters.length);
    }
}

/** An EngineCV CV to a JSON Resume v1.0.0 document, plus a report of what it cannot hold. */
export function resumeToJsonResume(resume: Resume, options: JsonResumeExportOptions = {}): JsonResumeExportResult {
    const exporter = new Exporter(resume, options);
    const document: Obj = {
        $schema: "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json",
        basics: exporter.basics(),
    };

    const bySection = new Map<EngineSection, string>(SECTION_MAPS.map((map) => [map.engine, map.jr]));
    for (const map of SECTION_MAPS) {
        const entries = exporter.section(map);
        if (entries.length > 0) document[bySection.get(map.engine) as string] = entries;
    }
    const skills = exporter.skills();
    if (skills.length > 0) document.skills = skills;
    exporter.leftOutSections();

    document.meta = {
        version: JSON_RESUME_VERSION,
        lastModified: (options.now ?? new Date()).toISOString().slice(0, 19),
    };
    return { document, report: exporter.report };
}
