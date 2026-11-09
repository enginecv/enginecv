import { settingsSchema, type Resume } from "../schema";
import { TEMPLATE_DOCUMENT_VERSION, type TemplateDocument } from "./template-schema";

type TemplateSettings = Resume["settings"];

type BuiltinTemplateDef = {
    id: string;
    name: string;
    description: string;
    tags: string[];
    paperSize: "a4" | "letter";
    settingsOverride: Record<string, unknown>;
};

const noBorder = {
    style: "solid" as const,
    width: 0,
    color: "",
    radius: 0,
    top: false,
    bottom: false,
    left: false,
    right: false,
    dashLength: 6,
    dashGap: 4,
};

// All templates share one "typeset CV" foundation: black type on white, a rule
// under every section heading, dates set apart from the content and no icons or
// colour. They differ in typeface, header, column structure and photo handling.
const INK = "#111111";
const SECTION_KEYS = ["experience", "education", "certificates", "projects", "skills", "languages"];

type LatexOptions = {
    font: string;
    size?: number;
    lineHeight?: number;
    marginH?: number;
    marginV?: number;
    itemSpacing?: number;
    name: { font?: string; size: number; transform?: "none" | "uppercase" };
    heading: { font?: string; size: number; spacing?: number; capitalization?: "uppercase" | "capitalize"; align?: "left" | "center"; marginBottom?: number };
    align: "left" | "center";
    detailsLayout?: "wrap" | "twoColumns";
    photoLayout?: "imageLeft" | "imageRight" | "imageTop";
    photo?: Record<string, unknown>;
    entry?: Record<string, unknown>;
    layout?: Record<string, unknown>;
    headerRule?: boolean;
    sectionBodyBorder?: Record<string, unknown>;
};

function latexSettings(o: LatexOptions): Record<string, unknown> {
    const rule = { ...noBorder, style: "solid" as const, width: 1, color: INK, bottom: true };
    const headingFont = o.heading.font ?? o.font;
    return {
        theme: "modern",
        colors: { variant: "basic", accent: INK, text: INK, background: "#ffffff", applyTo: ["headingsLine", "dotsBarsBubbles"] },
        typography: { fontFamily: o.font, fontSize: o.size ?? 11, lineHeight: o.lineHeight ?? 1.45 },
        spacing: { marginH: o.marginH ?? 18, marginV: o.marginV ?? 16, itemSpacing: o.itemSpacing ?? 10 },
        ...(o.layout ? { layout: o.layout } : {}),
        header: {
            fontFamily: o.name.font ?? o.font,
            fontSize: o.name.size,
            fontWeight: "700",
            fontStyle: "normal",
            textDecoration: "none",
            textTransform: o.name.transform ?? "none",
        },
        headings: {
            fontFamily: headingFont,
            fontSize: o.heading.size,
            fontWeight: "700",
            capitalization: o.heading.capitalization ?? "uppercase",
            letterSpacing: o.heading.spacing ?? 0.4,
            textAlign: o.heading.align ?? "left",
            style: "baseline",
            marginTop: 8,
            marginBottom: o.heading.marginBottom ?? 8,
            paddingTop: 0,
            paddingBottom: 2,
            border: rule,
        },
        // Typeset CVs carry no section icons.
        sectionDisplay: Object.fromEntries(SECTION_KEYS.map((key) => [key, { showIcon: false }])),
        entryLayout: {
            layout: "contentLeft",
            leftWidth: 78,
            middleWidth: 58,
            rightWidth: 20,
            titleFontSize: 11.5,
            subtitleFontSize: 11,
            subtitleFontWeight: "400",
            subtitleFontStyle: "italic",
            subtitleTextDecoration: "none",
            subtitlePlacement: "nextLine",
            indentBody: false,
            listStyle: "bullet",
            ...(o.entry ?? {}),
        },
        ...(o.sectionBodyBorder ? { contentStyle: o.sectionBodyBorder } : {}),
        personalDetails: {
            alignment: o.align,
            layout: o.photoLayout ?? "imageRight",
            detailsLayout: o.detailsLayout ?? "wrap",
            paddingTop: 0,
            paddingBottom: 6,
            paddingLeft: 0,
            paddingRight: 0,
            marginTop: 0,
            marginBottom: 8,
            marginLeft: 0,
            marginRight: 0,
            border: o.headerRule ? { ...noBorder, style: "solid", width: 1, color: INK, bottom: true } : { ...noBorder },
            ...(o.photo ? { photo: o.photo } : {}),
        },
    };
}

const photoFrame = (size: { width: number; height: number }, margin: Partial<Record<"marginLeft" | "marginRight" | "marginBottom", number>>, radius: number) => ({
    ...size,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
    ...margin,
    border: { ...noBorder, style: "solid", width: 1, color: INK, radius, top: true, bottom: true, left: true, right: true },
});

const BUILTIN_DEFS: BuiltinTemplateDef[] = [
    {
        id: "enginecv-modern",
        name: "Modern",
        description: "A clean typeset look: serif type, a centred name and a rule under every heading, with dates on the right.",
        tags: ["Modern", "Clean", "ATS"],
        paperSize: "a4",
        settingsOverride: latexSettings({
            font: "Source Serif Pro",
            name: { size: 26, transform: "uppercase" },
            heading: { size: 11 },
            align: "center",
        }),
    },
    {
        id: "enginecv-compact",
        name: "ATS Plain",
        description: "One plain column with no icons or graphics, built for applicant tracking systems.",
        tags: ["ATS", "Single Column", "Plain"],
        paperSize: "a4",
        settingsOverride: latexSettings({
            font: "Inter",
            size: 10.5,
            lineHeight: 1.4,
            itemSpacing: 8,
            name: { size: 24 },
            heading: { size: 11, spacing: 0.5 },
            align: "left",
            entry: { layout: "singleCol", subtitleFontStyle: "normal", subtitleFontWeight: "600" },
        }),
    },
    {
        id: "enginecv-sidebar",
        name: "Sidebar",
        description: "Two columns: a narrow side column for skills and languages, and the wide one for experience.",
        tags: ["Two Column", "Sidebar", "Structured"],
        paperSize: "a4",
        settingsOverride: latexSettings({
            font: "Source Serif Pro",
            marginH: 16,
            name: { size: 28 },
            heading: { size: 11 },
            align: "left",
            headerRule: true,
            entry: { layout: "singleCol", subtitleFontStyle: "italic" },
            layout: {
                columns: "two",
                headerPosition: "top",
                leftColumnWidth: 33,
                sectionPlacement: {
                    skills: "left",
                    languages: "left",
                    certificates: "left",
                    experience: "right",
                    education: "right",
                    projects: "right",
                },
                sectionOrder: ["experience", "education", "projects", "skills", "languages", "certificates"],
            },
        }),
    },
    {
        id: "enginecv-photo-header",
        name: "Photo Header",
        description: "A portrait beside your name and contact details, as many DACH and Balkan employers expect.",
        tags: ["Photo", "Europe", "Modern"],
        paperSize: "a4",
        settingsOverride: latexSettings({
            font: "Source Serif Pro",
            name: { size: 26 },
            heading: { size: 11 },
            align: "left",
            detailsLayout: "twoColumns",
            photoLayout: "imageLeft",
            photo: photoFrame({ width: 100, height: 100 }, { marginRight: 18 }, 999),
        }),
    },
    {
        id: "enginecv-lebenslauf",
        name: "Lebenslauf",
        description: "German conventions: portrait photo, a date column for every station, and a place, date and signature line.",
        tags: ["Lebenslauf", "German", "Photo"],
        paperSize: "a4",
        settingsOverride: latexSettings({
            font: "Source Serif Pro",
            size: 10.5,
            lineHeight: 1.4,
            itemSpacing: 7,
            name: { size: 26 },
            heading: { size: 12, spacing: 0, capitalization: "capitalize" },
            align: "left",
            detailsLayout: "twoColumns",
            headerRule: true,
            // Tabular dates: a fixed date column on the left of every entry.
            entry: { layout: "contentRight", leftWidth: 24, titleFontSize: 10.5, subtitleFontSize: 10, subtitleFontStyle: "normal", subtitleFontWeight: "600" },
            // Bewerbungsfoto proportions (3:4 portrait).
            photo: photoFrame({ width: 90, height: 120 }, {}, 2),
        }),
    },
    {
        id: "enginecv-timeline",
        name: "Timeline",
        description: "Chronological layout with a dashed rule running down the left of each section.",
        tags: ["Timeline", "Structured", "Chronological"],
        paperSize: "a4",
        settingsOverride: latexSettings({
            font: "Source Serif Pro",
            itemSpacing: 10,
            name: { size: 28 },
            heading: { size: 11 },
            align: "left",
            entry: { layout: "contentLeft", leftWidth: 78 },
            sectionBodyBorder: {
                paddingTop: 2,
                paddingBottom: 2,
                paddingLeft: 10,
                paddingRight: 0,
                marginTop: 0,
                marginBottom: 0,
                marginLeft: 0,
                marginRight: 0,
                border: { ...noBorder, style: "dashed", width: 1, color: INK, left: true, dashLength: 4, dashGap: 4 },
                backgroundColor: "",
                preset: "plain",
            },
        }),
    },
    {
        id: "enginecv-executive",
        name: "Executive",
        description: "Garamond serif with a centred header, spaced headings and generous leading, for senior roles.",
        tags: ["Executive", "Serif", "Senior"],
        paperSize: "a4",
        settingsOverride: {
            ...latexSettings({
                font: "EB Garamond",
                size: 11,
                lineHeight: 1.5,
                marginH: 22,
                marginV: 18,
                itemSpacing: 9,
                name: { size: 30, transform: "uppercase" },
                heading: { size: 11.5, spacing: 2.5, align: "center", marginBottom: 8 },
                align: "center",
                photoLayout: "imageTop",
                headerRule: true,
                entry: { titleFontSize: 11.5, subtitleFontSize: 11 },
            }),
            theme: "classic",
        },
    },
    {
        id: "enginecv-developer",
        name: "Developer",
        description: "Mono headings and projects first, so your best work leads the page.",
        tags: ["Developer", "Mono", "Tech"],
        paperSize: "a4",
        settingsOverride: latexSettings({
            font: "Inter",
            name: { font: "JetBrains Mono", size: 26 },
            heading: { font: "JetBrains Mono", size: 10.5, spacing: 0.8 },
            align: "left",
            detailsLayout: "twoColumns",
            entry: { subtitleFontStyle: "normal", subtitleFontWeight: "600" },
            // Projects first: for developers the work itself is the strongest evidence.
            layout: { sectionOrder: ["projects", "experience", "skills", "education", "languages", "certificates"] },
        }),
    },
];

function buildSettings(override: Record<string, unknown>): TemplateSettings {
    return settingsSchema.parse(override);
}

function defToTemplate(def: BuiltinTemplateDef, now: number): TemplateDocument {
    return {
        kind: "template",
        id: def.id,
        version: TEMPLATE_DOCUMENT_VERSION,
        meta: {
            name: def.name,
            description: def.description,
            tags: def.tags,
            source: "enginecv",
        },
        settings: buildSettings(def.settingsOverride),
        paperSize: def.paperSize,
        createdAt: now,
        updatedAt: now,
    };
}

let cached: TemplateDocument[] | null = null;

export function getBuiltinTemplates(): TemplateDocument[] {
    if (cached) return cached;
    const now = Date.now();
    cached = BUILTIN_DEFS.map((def) => defToTemplate(def, now));
    return cached;
}

/**
 * Templates retired when 18 near-duplicates were cut to 8 (#95), mapped to the
 * closest remaining one. Resumes keep their own copy of the design, so this
 * only keeps old template links and "based on" references working.
 */
const RETIRED_TEMPLATE_ALIASES: Record<string, string> = {
    "enginecv-classic": "enginecv-modern",
    "enginecv-creative": "enginecv-modern",
    "enginecv-corporate": "enginecv-modern",
    "enginecv-mosaic": "enginecv-modern",
    "enginecv-bold-header": "enginecv-modern",
    "enginecv-minimalist": "enginecv-compact",
    "enginecv-elegant": "enginecv-executive",
    "enginecv-academic": "enginecv-executive",
    "enginecv-editorial": "enginecv-executive",
    "enginecv-manuscript": "enginecv-executive",
    "enginecv-blueprint": "enginecv-developer",
    "enginecv-brutalist": "enginecv-developer",
};

/** The current ID for a built-in template ID, following retired aliases. */
export function resolveBuiltinTemplateId(id: string): string {
    return RETIRED_TEMPLATE_ALIASES[id] ?? id;
}

export function getBuiltinTemplateById(id: string): TemplateDocument | undefined {
    const resolved = resolveBuiltinTemplateId(id);
    return getBuiltinTemplates().find((t) => t.id === resolved);
}

export function isBuiltinTemplateId(id: string): boolean {
    const resolved = resolveBuiltinTemplateId(id);
    return BUILTIN_DEFS.some((def) => def.id === resolved);
}

export type TemplatePreviewOptions = {
    /** Show a sample photo: the template is designed around one. */
    photo?: boolean;
    /** Render the sample resume in this CV language. */
    language?: "de";
};

const PREVIEW_OPTIONS: Record<string, TemplatePreviewOptions> = {
    "enginecv-photo-header": { photo: true },
    "enginecv-lebenslauf": { photo: true, language: "de" },
};

/** How the sample resume should be dressed when previewing a built-in template. */
export function getTemplatePreviewOptions(id: string): TemplatePreviewOptions {
    return PREVIEW_OPTIONS[resolveBuiltinTemplateId(id)] ?? {};
}
