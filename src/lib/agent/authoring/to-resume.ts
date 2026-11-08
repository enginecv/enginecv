import { deriveOverallCefrLevel, CEFR_SKILLS, isCefrLevel } from "@/lib/cefr";
import { createId } from "@/lib/id";
import {
    basicsSchema,
    createEmptyResume,
    resumeSchema,
    UNGROUPED_SKILL_GROUP_ID,
    type Resume,
} from "@/lib/schema";
import { applyDesignHints, type DesignApplied } from "./design-hints";
import { NoticeList, type Notice, type PathSegment } from "./notices";
import {
    AUTHORING_FORMAT,
    AUTHORING_FORMAT_PREFIX,
    AUTHORING_SECTION_KEYS,
    BASICS_ALIASES,
    BASICS_FIELDS,
    CUSTOM_SECTION_FIELDS,
    LANGUAGE_ALIASES,
    LANGUAGE_FIELDS,
    LIST_SECTION_KEYS,
    PHOTO_KEYS,
    SECTION_ENTRY_SPECS,
    SECTION_SYNONYMS,
    SUMMARY_ALIASES,
    type AuthoringSectionKey,
    type EntrySpec,
    type FieldKind,
} from "./schema";
import {
    normaliseLink,
    normaliseSkillLevel,
    parseHumanDate,
    parseLanguageLevel,
    parseLanguageString,
    parseSkillString,
} from "./values";

export type SectionCounts = Record<AuthoringSectionKey, number>;

export interface ImportResult {
    /** `resumeSchema`-valid, no id yet. */
    resume: Resume;
    counts: SectionCounts;
    notices: Notice[];
    designApplied: DesignApplied;
}

type Obj = Record<string, unknown>;

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function isObj(value: unknown): value is Obj {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEmptyValue(value: unknown): boolean {
    return value === undefined || value === null || value === ""
        || (Array.isArray(value) && value.length === 0)
        || (isObj(value) && Object.keys(value).length === 0);
}

function isValidEmail(value: string): boolean {
    return basicsSchema.shape.email.safeParse(value).success;
}

/** One walk over one document. */
class Converter {
    readonly notices = new NoticeList();

    // -- values ---------------------------------------------------------------

    string(value: unknown, path: PathSegment[]): string | undefined {
        if (value === undefined || value === null) return undefined;
        if (typeof value === "string") return value;
        if (typeof value === "number" || typeof value === "boolean") {
            this.notices.add("adjusted", "value-coerced", path, { value: String(value) });
            return String(value);
        }
        this.notices.add("skipped", "value-invalid", path);
        return undefined;
    }

    markdown(value: unknown, path: PathSegment[]): string | undefined {
        if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
            this.notices.add("adjusted", "value-coerced", path, { value: `${value.length}` });
            return value.map((item) => `- ${item}`).join("\n");
        }
        return this.string(value, path);
    }

    list(value: unknown, path: PathSegment[]): string[] | undefined {
        if (value === undefined || value === null) return undefined;
        if (typeof value === "string") {
            const items = value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);
            if (items.length !== 1 || items[0] !== value) {
                this.notices.add("adjusted", "list-split", path, { value, count: `${items.length}` });
            }
            return items;
        }
        if (!Array.isArray(value)) {
            this.notices.add("skipped", "value-invalid", path);
            return undefined;
        }
        const out: string[] = [];
        value.forEach((item, index) => {
            const text = this.string(item, [...path, index]);
            if (text !== undefined) out.push(text);
        });
        return out;
    }

    highlights(value: unknown, path: PathSegment[]): string[] | undefined {
        if (typeof value === "string") {
            const items = value
                .split(/\r?\n/)
                .map((line) => line.replace(/^\s*(?:[-*•+]|\d+[.)])\s+/, "").trim())
                .filter(Boolean);
            this.notices.add("adjusted", "highlights-split", path, { count: `${items.length}` });
            return items;
        }
        return this.list(value, path);
    }

    date(value: unknown, path: PathSegment[]): string | undefined {
        const text = this.string(value, path);
        if (text === undefined) return undefined;
        const parsed = parseHumanDate(text);
        this.notices.addIssue(parsed.issue, path);
        return parsed.value;
    }

    link(value: unknown, path: PathSegment[]): string | undefined {
        const text = this.string(value, path);
        if (text === undefined) return undefined;
        const parsed = normaliseLink(text);
        this.notices.addIssue(parsed.issue, path);
        return parsed.value;
    }

    email(value: unknown, path: PathSegment[]): string | undefined {
        const text = this.string(value, path);
        if (text === undefined) return undefined;
        const trimmed = text.trim();
        if (trimmed === "" || isValidEmail(trimmed)) return trimmed;
        this.notices.add("skipped", "email-invalid", path, { value: text });
        return "";
    }

    hidden(value: unknown, path: PathSegment[]): boolean | undefined {
        if (value === undefined || value === null) return undefined;
        if (typeof value === "boolean") return value;
        if (value === "true" || value === "false") {
            this.notices.add("adjusted", "value-coerced", path, { value });
            return value === "true";
        }
        this.notices.add("skipped", "value-invalid", path);
        return undefined;
    }

    id(value: unknown, path: PathSegment[], used: Set<string>): string {
        if (value !== undefined && value !== null) {
            const text = typeof value === "string" ? value : String(value);
            if (ID_PATTERN.test(text) && !used.has(text)) {
                used.add(text);
                return text;
            }
            this.notices.add("adjusted", "id-regenerated", path, { value: text });
        }
        let id = createId();
        while (used.has(id)) id = createId();
        used.add(id);
        return id;
    }

    repos(value: unknown, path: PathSegment[]): Obj[] | undefined {
        if (value === undefined || value === null) return undefined;
        const items = typeof value === "string" ? [value] : value;
        if (!Array.isArray(items)) {
            this.notices.add("skipped", "value-invalid", path);
            return undefined;
        }
        const out: Obj[] = [];
        items.forEach((item, index) => {
            const itemPath = [...path, index];
            if (typeof item === "string") {
                const url = this.link(item, itemPath);
                if (url) out.push({ url, label: "", platform: "auto" });
                return;
            }
            if (!isObj(item)) {
                this.notices.add("skipped", "entry-invalid", itemPath);
                return;
            }
            const url = this.link(item.url, [...itemPath, "url"]) ?? "";
            const label = this.string(item.label, [...itemPath, "label"]) ?? "";
            const platform = this.string(item.platform, [...itemPath, "platform"]) ?? "auto";
            for (const key of Object.keys(item)) {
                if (!["url", "label", "platform"].includes(key)) {
                    this.notices.add("skipped", "unknown-field-skipped", [...itemPath, key], { field: key });
                }
            }
            if (url) out.push({ url, label, platform });
            else this.notices.add("skipped", "entry-invalid", itemPath);
        });
        return out;
    }

    field(kind: FieldKind, value: unknown, path: PathSegment[]): unknown {
        switch (kind) {
            case "hidden": return this.hidden(value, path);
            case "markdown": return this.markdown(value, path);
            case "date": return this.date(value, path);
            case "link": return this.link(value, path);
            case "email": return this.email(value, path);
            case "list": return this.list(value, path);
            case "highlights": return this.highlights(value, path);
            case "repos": return this.repos(value, path);
            case "visibility": {
                const text = this.string(value, path);
                if (text === undefined) return undefined;
                if (text === "public" || text === "private") return text;
                this.notices.add("skipped", "value-invalid", path, { value: text });
                return undefined;
            }
            case "skillLevel": {
                const text = this.string(value, path);
                if (text === undefined) return undefined;
                const parsed = normaliseSkillLevel(text);
                this.notices.addIssue(parsed.issue, path);
                return parsed.value;
            }
            default: return this.string(value, path);
        }
    }

    // -- entries --------------------------------------------------------------

    /**
     * Maps one entry through its spec: canonical fields win over aliases,
     * aliases are renamed with a notice, anything else is appended to the
     * description as text so nothing is lost.
     */
    entry(raw: unknown, spec: EntrySpec, path: PathSegment[], usedIds: Set<string>): Obj | undefined {
        if (!isObj(raw)) {
            this.notices.add("skipped", "entry-invalid", path);
            return undefined;
        }

        const chosen = new Map<string, { key: string; value: unknown }>();
        for (const [key, value] of Object.entries(raw)) {
            if (key in spec.fields) chosen.set(key, { key, value });
        }
        const extras: [string, unknown][] = [];
        for (const [key, value] of Object.entries(raw)) {
            if (key in spec.fields) continue;
            const target = (spec.aliases as Record<string, string>)[key];
            if (target && !chosen.has(target)) {
                chosen.set(target, { key, value });
                this.notices.add("adjusted", "field-renamed", [...path, key], { field: key, result: target });
            } else if (PHOTO_KEYS.includes(key)) {
                this.notices.add("skipped", "photo-ignored", [...path, key]);
            } else {
                extras.push([key, value]);
            }
        }

        const out: Obj = {};
        for (const [name, field] of Object.entries(spec.fields)) {
            const found = chosen.get(name);
            if (name === "id") {
                out.id = this.id(found?.value, [...path, found?.key ?? "id"], usedIds);
                continue;
            }
            if (!found) continue;
            const value = this.field(field.kind, found.value, [...path, found.key]);
            if (value !== undefined) out[name] = value;
        }

        const textField = "description" in spec.fields ? "description" : "text";
        this.appendExtras(out, textField, extras, path);
        return out;
    }

    appendExtras(out: Obj, textField: string, extras: [string, unknown][], path: PathSegment[]) {
        const lines: string[] = [];
        for (const [key, value] of extras) {
            if (isEmptyValue(value)) continue;
            lines.push(`${key}: ${stringifyExtra(value)}`);
            this.notices.add("adjusted", "unknown-field-to-description", [...path, key], { field: key });
        }
        if (lines.length === 0) return;
        const current = typeof out[textField] === "string" ? (out[textField] as string) : "";
        out[textField] = current ? `${current}\n\n${lines.join("\n")}` : lines.join("\n");
    }

    entries(raw: unknown, spec: EntrySpec, path: PathSegment[]): Obj[] {
        const items = this.asArray(raw, path);
        const used = new Set<string>();
        const out: Obj[] = [];
        items.forEach((item, index) => {
            const entry = this.entry(item, spec, [...path, index], used);
            if (entry) out.push(entry);
        });
        return out;
    }

    /** A single object where a list was expected is taken as a one-item list. */
    asArray(raw: unknown, path: PathSegment[]): unknown[] {
        if (Array.isArray(raw)) return raw;
        if (raw === undefined || raw === null) return [];
        if (isObj(raw)) {
            this.notices.add("adjusted", "value-coerced", path, { value: "1" });
            return [raw];
        }
        this.notices.add("skipped", "value-invalid", path);
        return [];
    }

    // -- basics ---------------------------------------------------------------

    basics(raw: unknown, path: PathSegment[]): { basics: Obj; summary?: string } {
        const basics: Obj = {};
        if (raw === undefined || raw === null) return { basics };
        if (!isObj(raw)) {
            this.notices.add("skipped", "value-invalid", path);
            return { basics };
        }

        const chosen = new Map<string, { key: string; value: unknown }>();
        for (const [key, value] of Object.entries(raw)) {
            if (key in BASICS_FIELDS) chosen.set(key, { key, value });
        }
        let summary: string | undefined;
        for (const [key, value] of Object.entries(raw)) {
            if (key in BASICS_FIELDS) continue;
            const target = BASICS_ALIASES[key];
            if (target && !chosen.has(target)) {
                chosen.set(target, { key, value });
                this.notices.add("adjusted", "field-renamed", [...path, key], { field: key, result: target });
            } else if (key === "summary") {
                summary = this.markdown(value, [...path, key]);
            } else if (PHOTO_KEYS.includes(key)) {
                this.notices.add("skipped", "photo-ignored", [...path, key]);
            } else if (!isEmptyValue(value)) {
                this.notices.add("skipped", "unknown-field-skipped", [...path, key], { field: key });
            }
        }

        for (const [name, field] of Object.entries(BASICS_FIELDS)) {
            const found = chosen.get(name);
            if (!found) continue;
            const fieldPath = [...path, found.key];
            if (name === "email") {
                const emails = this.emails(found.value, fieldPath);
                basics.emails = emails;
                basics.email = (emails[0]?.email as string | undefined) ?? "";
            } else if (name === "links") {
                basics.customLinks = this.links(found.value, fieldPath);
            } else {
                const value = this.field(field.kind, found.value, fieldPath);
                if (value !== undefined) basics[name] = value;
            }
        }
        return { basics, summary };
    }

    emails(value: unknown, path: PathSegment[]): Obj[] {
        const items = Array.isArray(value) ? value : [value];
        const out: Obj[] = [];
        items.forEach((item, index) => {
            const itemPath = Array.isArray(value) ? [...path, index] : path;
            if (isObj(item)) {
                const email = this.email(item.email, [...itemPath, "email"]);
                const label = this.string(item.label, [...itemPath, "label"]) ?? "";
                if (email) out.push({ id: createId(), email, label });
                return;
            }
            const email = this.email(item, itemPath);
            if (email) out.push({ id: createId(), email, label: "" });
        });
        return out;
    }

    links(value: unknown, path: PathSegment[]): Obj[] {
        const out: Obj[] = [];
        this.asArray(value, path).forEach((item, index) => {
            const itemPath = [...path, index];
            if (typeof item === "string") {
                const url = this.link(item, itemPath) ?? "";
                if (url) out.push({ id: createId(), name: "", url, label: "", icon: "auto" });
                return;
            }
            if (!isObj(item)) {
                this.notices.add("skipped", "entry-invalid", itemPath);
                return;
            }
            const url = this.link(item.url, [...itemPath, "url"]) ?? "";
            const nameKey = item.name !== undefined ? "name" : "network";
            const name = this.string(item[nameKey], [...itemPath, nameKey]) ?? "";
            const label = this.string(item.label, [...itemPath, "label"]) ?? "";
            for (const key of Object.keys(item)) {
                if (!["url", "name", "network", "label"].includes(key)) {
                    this.notices.add("skipped", "unknown-field-skipped", [...itemPath, key], { field: key });
                }
            }
            if (url || name) out.push({ id: createId(), name, url, label, icon: "auto" });
        });
        return out;
    }

    // -- skills ---------------------------------------------------------------

    skills(raw: unknown, path: PathSegment[]): Obj[] {
        const ungrouped: Obj = { id: UNGROUPED_SKILL_GROUP_ID, name: "", hidden: false, skills: [] };
        const groups: Obj[] = [ungrouped];
        const used = new Set<string>();

        const addTo = (group: Obj, items: unknown, itemsPath: PathSegment[]) => {
            const skills = group.skills as Obj[];
            const list = typeof items === "string" ? this.list(items, itemsPath) ?? [] : this.asArray(items, itemsPath);
            list.forEach((item, index) => {
                const skill = this.skill(item, [...itemsPath, index], used);
                if (skill) skills.push(skill);
            });
        };

        if (Array.isArray(raw)) {
            raw.forEach((item, index) => {
                const itemPath = [...path, index];
                if (isObj(item) && ("group" in item || ("skills" in item && !("name" in item)))) {
                    const name = this.string(item.group, [...itemPath, "group"])?.trim() ?? "";
                    const hidden = this.hidden(item.hidden, [...itemPath, "hidden"]) ?? false;
                    for (const key of Object.keys(item)) {
                        if (!["group", "skills", "hidden"].includes(key)) {
                            this.notices.add("skipped", "unknown-field-skipped", [...itemPath, key], { field: key });
                        }
                    }
                    // An explicit "group" key is its own group, even unnamed (the
                    // onboarding examples keep their skills in one); only a bare
                    // { skills } joins the ungrouped skills.
                    const group = "group" in item || hidden
                        ? { id: createId(), name, hidden, skills: [] }
                        : ungrouped;
                    if (group !== ungrouped) groups.push(group);
                    addTo(group, item.skills ?? [], [...itemPath, "skills"]);
                    return;
                }
                const skill = this.skill(item, itemPath, used);
                if (skill) (ungrouped.skills as Obj[]).push(skill);
            });
        } else if (isObj(raw)) {
            for (const [name, items] of Object.entries(raw)) {
                const group = name.trim() === ""
                    ? ungrouped
                    : { id: createId(), name, hidden: false, skills: [] };
                if (group !== ungrouped) groups.push(group);
                addTo(group, items, [...path, name]);
            }
        } else if (raw !== undefined && raw !== null) {
            this.notices.add("skipped", "value-invalid", path);
        }
        return groups;
    }

    skill(raw: unknown, path: PathSegment[], used: Set<string>): Obj | undefined {
        if (typeof raw === "string") {
            if (!raw.trim()) {
                this.notices.add("skipped", "entry-invalid", path);
                return undefined;
            }
            const parsed = parseSkillString(raw);
            this.notices.addIssue(parsed.issue, path);
            return { id: this.id(undefined, path, used), name: parsed.value.name, level: parsed.value.level };
        }
        const skill = this.entry(raw, SECTION_ENTRY_SPECS.skill, path, used);
        // "TypeScript (expert)" inside an object without a level of its own.
        if (skill && typeof skill.name === "string" && !skill.level) {
            const parsed = parseSkillString(skill.name);
            if (parsed.value.level) {
                this.notices.addIssue(parsed.issue, [...path, "name"]);
                skill.name = parsed.value.name;
                skill.level = parsed.value.level;
            }
        }
        return skill;
    }

    // -- languages --------------------------------------------------------------

    languages(raw: unknown, path: PathSegment[]): Obj[] {
        const used = new Set<string>();
        const out: Obj[] = [];
        this.asArray(raw, path).forEach((item, index) => {
            const language = this.language(item, [...path, index], used);
            if (language) out.push(language);
        });
        return out;
    }

    language(raw: unknown, path: PathSegment[], used: Set<string>): Obj | undefined {
        if (typeof raw === "string") {
            if (!raw.trim()) {
                this.notices.add("skipped", "entry-invalid", path);
                return undefined;
            }
            const parsed = parseLanguageString(raw);
            this.notices.addIssue(parsed.issue, path);
            return { id: this.id(undefined, path, used), ...parsed.value };
        }
        if (!isObj(raw)) {
            this.notices.add("skipped", "entry-invalid", path);
            return undefined;
        }

        const chosen = new Map<string, { key: string; value: unknown }>();
        for (const [key, value] of Object.entries(raw)) {
            if ((LANGUAGE_FIELDS as readonly string[]).includes(key)) chosen.set(key, { key, value });
        }
        const extras: [string, unknown][] = [];
        for (const [key, value] of Object.entries(raw)) {
            if ((LANGUAGE_FIELDS as readonly string[]).includes(key)) continue;
            const target = LANGUAGE_ALIASES[key];
            if (target && !chosen.has(target)) {
                chosen.set(target, { key, value });
                this.notices.add("adjusted", "field-renamed", [...path, key], { field: key, result: target });
            } else {
                extras.push([key, value]);
            }
        }
        const read = (name: string) => chosen.get(name);
        const at = (name: string) => [...path, read(name)?.key ?? name];

        const out: Obj = { id: this.id(read("id")?.value, at("id"), used) };
        out.language = this.string(read("language")?.value, at("language")) ?? "";
        const level = this.string(read("level")?.value, at("level"));
        if (level !== undefined) {
            const parsed = parseLanguageLevel(level);
            this.notices.addIssue(parsed.issue, at("level"));
            out.fluency = parsed.value;
        }

        const cefrRaw = read("cefr")?.value;
        if (isObj(cefrRaw)) {
            const cefr: Record<string, string> = {};
            for (const [skill, value] of Object.entries(cefrRaw)) {
                const skillPath = [...at("cefr"), skill];
                if (!(CEFR_SKILLS as readonly string[]).includes(skill)) {
                    this.notices.add("skipped", "unknown-field-skipped", skillPath, { field: skill });
                    continue;
                }
                const text = this.string(value, skillPath)?.trim() ?? "";
                if (!text) continue;
                if (isCefrLevel(text.toUpperCase())) {
                    cefr[skill] = text.toUpperCase();
                    if (text.toUpperCase() !== text) {
                        this.notices.add("adjusted", "language-normalised", skillPath, { value: text, result: cefr[skill] });
                    }
                } else {
                    this.notices.add("skipped", "value-invalid", skillPath, { value: text });
                }
            }
            if (Object.keys(cefr).length > 0) {
                out.cefr = cefr;
                out.cefrDetailed = true;
                if (!out.fluency) out.fluency = deriveOverallCefrLevel(cefr);
            }
        } else if (cefrRaw !== undefined && cefrRaw !== null) {
            this.notices.add("skipped", "value-invalid", at("cefr"));
        }

        const certificate = read("certificate")?.value;
        if (isObj(certificate)) {
            const certPath = at("certificate");
            out.assessmentType = "issuer";
            out.issuer = this.string(certificate.issuer, [...certPath, "issuer"]) ?? "";
            out.assessmentId = this.string(certificate.id, [...certPath, "id"]) ?? "";
            out.assessmentUrl = this.link(certificate.url, [...certPath, "url"]) ?? "";
            for (const key of Object.keys(certificate)) {
                if (!["issuer", "id", "url"].includes(key)) {
                    this.notices.add("skipped", "unknown-field-skipped", [...certPath, key], { field: key });
                }
            }
        } else if (certificate !== undefined && certificate !== null) {
            this.notices.add("skipped", "value-invalid", at("certificate"));
        }

        const selfAssessed = this.hidden(read("selfAssessed")?.value, at("selfAssessed"));
        if (selfAssessed && out.assessmentType !== "issuer") out.assessmentType = "self";

        const description = this.markdown(read("description")?.value, at("description"));
        if (description !== undefined) out.description = description;
        const hidden = this.hidden(read("hidden")?.value, at("hidden"));
        if (hidden !== undefined) out.hidden = hidden;

        this.appendExtras(out, "description", extras, path);
        return out;
    }

    // -- interests, declaration, custom ----------------------------------------

    interests(raw: unknown, path: PathSegment[]): Obj[] {
        const used = new Set<string>();
        const out: Obj[] = [];
        this.asArray(raw, path).forEach((item, index) => {
            const itemPath = [...path, index];
            if (typeof item === "string") {
                if (item.trim()) out.push({ id: this.id(undefined, itemPath, used), name: item });
                else this.notices.add("skipped", "entry-invalid", itemPath);
                return;
            }
            const entry = this.entry(item, SECTION_ENTRY_SPECS.interests, itemPath, used);
            if (entry) out.push(entry);
        });
        return out;
    }

    declaration(raw: unknown, path: PathSegment[]): Obj[] {
        if (isObj(raw)) {
            const entry = this.entry(raw, SECTION_ENTRY_SPECS.declaration, path, new Set());
            return entry ? [entry] : [];
        }
        if (typeof raw === "string") {
            return raw.trim() ? [{ id: createId(), text: raw }] : [];
        }
        return this.entries(raw, SECTION_ENTRY_SPECS.declaration, path);
    }

    customSections(raw: unknown, path: PathSegment[], used: Set<string>): Obj[] {
        if (isObj(raw)) {
            // { "Volunteering": [...] }: titles as keys.
            this.notices.add("adjusted", "value-coerced", path, { value: `${Object.keys(raw).length}` });
            return Object.entries(raw)
                .map(([title, value]) => this.customFromValue(title, value, [...path, title], used))
                .filter((section): section is Obj => section !== undefined);
        }
        const out: Obj[] = [];
        this.asArray(raw, path).forEach((item, index) => {
            const section = this.customSection(item, [...path, index], used);
            if (section) out.push(section);
        });
        return out;
    }

    customSection(raw: unknown, path: PathSegment[], used: Set<string>): Obj | undefined {
        if (!isObj(raw)) {
            this.notices.add("skipped", "entry-invalid", path);
            return undefined;
        }
        const out: Obj = { id: this.id(raw.id, [...path, "id"], used) };
        const title = this.string(raw.title ?? raw.name, [...path, raw.title !== undefined ? "title" : "name"]);
        if (title === undefined || !title.trim()) {
            this.notices.add("review", "custom-title-missing", path);
        }
        out.title = title ?? "";
        if (raw.title === undefined && raw.name !== undefined) {
            this.notices.add("adjusted", "field-renamed", [...path, "name"], { field: "name", result: "title" });
        }

        const hidden = this.hidden(raw.hidden, [...path, "hidden"]);
        if (hidden !== undefined) out.hidden = hidden;

        if (raw.entries !== undefined) {
            out.entries = this.entries(raw.entries, SECTION_ENTRY_SPECS.customEntry, [...path, "entries"]);
        }
        if (raw.text !== undefined) out.text = this.markdown(raw.text, [...path, "text"]) ?? "";
        if (raw.tags !== undefined) out.tags = this.list(raw.tags, [...path, "tags"]) ?? [];
        out.layout = raw.entries !== undefined ? "entries" : raw.text !== undefined ? "text" : raw.tags !== undefined ? "tags" : "text";

        for (const key of Object.keys(raw)) {
            if (!(CUSTOM_SECTION_FIELDS as readonly string[]).includes(key) && key !== "name") {
                this.notices.add("skipped", "unknown-field-skipped", [...path, key], { field: key });
            }
        }
        return out;
    }

    /** Any value under a title → the custom section that holds it best. */
    customFromValue(title: string, value: unknown, path: PathSegment[], used: Set<string>): Obj | undefined {
        if (isEmptyValue(value)) return undefined;
        const base = { id: this.id(undefined, path, used), title };
        if (typeof value === "string") return { ...base, layout: "text", text: value };
        if (typeof value === "number" || typeof value === "boolean") {
            return { ...base, layout: "text", text: String(value) };
        }
        if (Array.isArray(value)) {
            if (value.every((item) => typeof item === "string")) {
                return { ...base, layout: "tags", tags: value };
            }
            const entryUsed = new Set<string>();
            const entries: Obj[] = [];
            value.forEach((item, index) => {
                const itemPath = [...path, index];
                const entry = typeof item === "string"
                    ? { id: this.id(undefined, itemPath, entryUsed), title: item }
                    : this.entry(item, SECTION_ENTRY_SPECS.customEntry, itemPath, entryUsed);
                if (entry) entries.push(entry);
            });
            return { ...base, layout: "entries", entries };
        }
        if (isObj(value)) {
            const lines = Object.entries(value)
                .filter(([, item]) => !isEmptyValue(item))
                .map(([key, item]) => `${key}: ${stringifyExtra(item)}`);
            return { ...base, layout: "text", text: lines.join("\n") };
        }
        return undefined;
    }
}

function stringifyExtra(value: unknown): string {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value) && value.every((item) => ["string", "number", "boolean"].includes(typeof item))) {
        return value.join(", ");
    }
    return JSON.stringify(value);
}

/** "openSource" / "open_source" → "Open source". */
export function titleFromKey(key: string): string {
    const words = key
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .trim()
        .toLowerCase();
    return words ? words[0].toUpperCase() + words.slice(1) : key;
}

function emptyCounts(): SectionCounts {
    return Object.fromEntries(AUTHORING_SECTION_KEYS.map((key) => [key, 0])) as SectionCounts;
}

function resolveSectionKey(key: string): AuthoringSectionKey | undefined {
    if ((AUTHORING_SECTION_KEYS as readonly string[]).includes(key)) return key as AuthoringSectionKey;
    return SECTION_SYNONYMS[key];
}

/**
 * The one conversion from an authoring document to a stored CV. Validates
 * leniently, never throws, and the returned resume always passes
 * `resumeSchema.parse`. Everything not taken as given is in `notices`.
 */
export function authoringToResume(document: unknown, options: { now?: number } = {}): ImportResult {
    const convert = new Converter();
    const notices = convert.notices;
    const counts = emptyCounts();
    const now = options.now ?? Date.now();

    if (!isObj(document)) {
        notices.add("skipped", "value-invalid", []);
        return { resume: createEmptyResume(), counts, notices: notices.items, designApplied: {} };
    }

    const format = document.format;
    if (format === undefined) {
        notices.add("review", "format-missing", []);
    } else if (typeof format === "string" && format.startsWith(AUTHORING_FORMAT_PREFIX)) {
        const version = Number(format.slice(AUTHORING_FORMAT_PREFIX.length));
        if (format !== AUTHORING_FORMAT && Number.isFinite(version) && version > 1) {
            notices.add("review", "newer-version", ["format"], { value: format });
        } else if (format !== AUTHORING_FORMAT) {
            notices.add("review", "format-unknown", ["format"], { value: String(format) });
        }
    } else {
        notices.add("review", "format-unknown", ["format"], { value: String(format) });
    }

    const resume: Obj = {};
    const sectionOrder: string[] = [];
    const sections: Partial<Record<AuthoringSectionKey, Obj[]>> = {};
    const customUsed = new Set<string>();
    let customSections: Obj[] = [];
    let summary: string | undefined;
    let basicsSummary: string | undefined;
    const addSection = (key: string) => {
        if (!sectionOrder.includes(key)) sectionOrder.push(key);
    };

    for (const [key, value] of Object.entries(document)) {
        const path = [key];
        if (key === "format" || key === "design" || key === "$schema") continue;
        if (key === "basics") {
            const mapped = convert.basics(value, path);
            resume.basics = mapped.basics;
            basicsSummary = mapped.summary;
            continue;
        }
        if (key === "summary" || SUMMARY_ALIASES.includes(key)) {
            if (summary !== undefined) {
                notices.add("skipped", "unknown-field-skipped", path, { field: key });
                continue;
            }
            if (key !== "summary") notices.add("adjusted", "section-renamed", path, { key, result: "summary" });
            summary = convert.markdown(value, path);
            continue;
        }
        if (PHOTO_KEYS.includes(key)) {
            notices.add("skipped", "photo-ignored", path);
            continue;
        }

        const section = resolveSectionKey(key);
        if (!section) {
            notices.add("adjusted", "unknown-key-to-custom", path, { key });
            const custom = convert.customFromValue(titleFromKey(key), value, path, customUsed);
            if (custom) {
                customSections.push(custom);
                addSection(`custom:${custom.id as string}`);
            }
            continue;
        }
        if (section !== key) notices.add("adjusted", "section-renamed", path, { key, result: section });

        if (section === "custom") {
            const mapped = convert.customSections(value, path, customUsed);
            customSections = [...customSections, ...mapped];
            for (const custom of mapped) addSection(`custom:${custom.id as string}`);
            continue;
        }

        let mapped: Obj[];
        if ((LIST_SECTION_KEYS as readonly string[]).includes(section)) {
            mapped = convert.entries(value, SECTION_ENTRY_SPECS[section as (typeof LIST_SECTION_KEYS)[number]], path);
        } else if (section === "declaration") {
            mapped = convert.declaration(value, path);
        } else if (section === "skills") {
            mapped = convert.skills(value, path);
        } else if (section === "languages") {
            mapped = convert.languages(value, path);
        } else {
            mapped = convert.interests(value, path);
        }
        sections[section] = [...(sections[section] ?? []), ...mapped];
        addSection(section);
    }

    if (summary === undefined && basicsSummary !== undefined) {
        notices.add("adjusted", "field-renamed", ["basics", "summary"], { field: "summary", result: "summary" });
        summary = basicsSummary;
    }
    resume.basics = { ...(resume.basics as Obj | undefined), ...(summary !== undefined ? { summary } : {}) };

    for (const [section, entries] of Object.entries(sections) as [AuthoringSectionKey, Obj[]][]) {
        if (section === "skills") {
            resume.skillGroups = entries;
            counts.skills = entries.reduce((sum, group) => sum + (group.skills as Obj[]).length, 0);
        } else {
            resume[section] = entries;
            counts[section] = entries.length;
        }
    }
    resume.customSections = customSections;
    counts.custom = customSections.length;

    const contentSections = sectionOrder.filter((key) =>
        key.startsWith("custom:") || (key === "skills" ? counts.skills > 0 : counts[key as AuthoringSectionKey] > 0),
    );
    const name = typeof (resume.basics as Obj).name === "string" ? ((resume.basics as Obj).name as string) : "";
    const base = createEmptyResume();

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
        notices.add("skipped", "value-invalid", []);
        return { resume: createEmptyResume(), counts: emptyCounts(), notices: notices.items, designApplied: {} };
    }

    const designed = applyDesignHints(parsed.data, document.design, notices);
    const final = resumeSchema.safeParse(designed.resume);
    return {
        resume: final.success ? final.data : parsed.data,
        counts,
        notices: notices.items,
        designApplied: final.success ? designed.applied : {},
    };
}
