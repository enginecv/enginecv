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

const BUILTIN_DEFS: BuiltinTemplateDef[] = [
    {
        id: "enginecv-modern",
        name: "Modern",
        description: "Clean blue-accented sans-serif with a clear name and job title, hairline heading rules and generous spacing.",
        tags: ["Modern", "Clean", "ATS"],
        paperSize: "a4",
        settingsOverride: {
            theme: "modern",
            colors: {
                variant: "basic",
                accent: "#2563eb",
                text: "#0f172a",
                background: "#ffffff",
                applyTo: ["headings", "headingsLine", "dotsBarsBubbles", "jobTitle", "headerIcons"],
            },
            typography: { fontFamily: "Inter", fontSize: 10.5, lineHeight: 1.5 },
            spacing: { marginH: 20, marginV: 18, itemSpacing: 12 },
            header: {
                fontFamily: "Inter",
                fontSize: 34,
                fontWeight: "700",
                fontStyle: "normal",
                textDecoration: "none",
                textTransform: "none",
            },
            headings: {
                fontFamily: "Inter",
                fontSize: 12,
                fontWeight: "700",
                capitalization: "uppercase",
                letterSpacing: 1.5,
                style: "baseline",
                marginBottom: 12,
                paddingTop: 4,
                paddingBottom: 4,
                border: { ...noBorder, style: "solid", width: 1, color: "#2563eb", bottom: true },
            },
            personalDetails: {
                alignment: "left",
                layout: "imageRight",
                detailsLayout: "wrap",
                paddingTop: 0,
                paddingBottom: 10,
                paddingLeft: 0,
                paddingRight: 0,
                marginTop: 0,
                marginBottom: 10,
                marginLeft: 0,
                marginRight: 0,
                border: { ...noBorder, style: "solid", width: 1, color: "#e2e8f0", bottom: true },
            },
        },
    },
    {
        id: "enginecv-compact",
        name: "ATS Plain",
        description: "One plain column with no icons or graphics, built for applicant tracking systems.",
        tags: ["ATS", "Single Column", "Plain"],
        paperSize: "a4",
        settingsOverride: {
            theme: "modern",
            colors: {
                variant: "basic",
                accent: "#111827",
                text: "#111827",
                background: "#ffffff",
                applyTo: ["headingsLine"],
            },
            typography: { fontFamily: "Inter", fontSize: 10.5, lineHeight: 1.5 },
            spacing: { marginH: 18, marginV: 16, itemSpacing: 10 },
            header: {
                fontFamily: "Inter",
                fontSize: 26,
                fontWeight: "700",
                fontStyle: "normal",
                textDecoration: "none",
                textTransform: "none",
            },
            headings: {
                fontFamily: "Inter",
                fontSize: 11.5,
                fontWeight: "700",
                capitalization: "uppercase",
                letterSpacing: 0.5,
                style: "baseline",
                marginBottom: 8,
                paddingBottom: 2,
                border: { ...noBorder, style: "solid", width: 1, color: "#111827", bottom: true },
            },
            // Section icons are decoration a parser can't read.
            sectionDisplay: Object.fromEntries(
                ["experience", "education", "certificates", "projects", "skills", "languages"].map((key) => [key, { showIcon: false }]),
            ),
            entryLayout: { layout: "singleCol", titleFontSize: 11, subtitleFontSize: 10.5 },
            personalDetails: {
                alignment: "left",
                layout: "imageRight",
                detailsLayout: "wrap",
                paddingTop: 0,
                paddingBottom: 6,
                paddingLeft: 0,
                paddingRight: 0,
                marginTop: 0,
                marginBottom: 8,
                marginLeft: 0,
                marginRight: 0,
                border: { ...noBorder },
            },
        },
    },
    {
        id: "enginecv-sidebar",
        name: "Sidebar",
        description: "Two-column layout with indigo section bars, a compact skills rail and a bold name.",
        tags: ["Two Column", "Sidebar", "Structured"],
        paperSize: "a4",
        settingsOverride: {
            theme: "modern",
            colors: {
                variant: "basic",
                accent: "#4338ca",
                text: "#111827",
                background: "#ffffff",
                applyTo: ["name", "headings", "headingsLine", "dotsBarsBubbles", "jobTitle"],
            },
            typography: { fontFamily: "Inter", fontSize: 10.5, lineHeight: 1.5 },
            spacing: { marginH: 16, marginV: 16, itemSpacing: 10 },
            layout: {
                columns: "two",
                headerPosition: "top",
                leftColumnWidth: 34,
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
            header: {
                fontFamily: "Inter",
                fontSize: 32,
                fontWeight: "700",
                fontStyle: "normal",
                textDecoration: "none",
                textTransform: "none",
            },
            headings: {
                fontFamily: "Inter",
                fontSize: 11.5,
                fontWeight: "700",
                capitalization: "uppercase",
                letterSpacing: 1.2,
                textAlign: "left",
                style: "baseline",
                marginBottom: 8,
                paddingTop: 4,
                paddingBottom: 4,
                paddingLeft: 8,
                backgroundColor: "#eef2ff",
                border: { ...noBorder },
            },
            personalDetails: {
                alignment: "left",
                layout: "imageRight",
                detailsLayout: "wrap",
                paddingTop: 0,
                paddingBottom: 10,
                paddingLeft: 0,
                paddingRight: 0,
                marginTop: 0,
                marginBottom: 10,
                marginLeft: 0,
                marginRight: 0,
                border: { ...noBorder, style: "solid", width: 2, color: "#4338ca", bottom: true },
                photo: {
                    width: 96,
                    height: 96,
                    paddingTop: 0,
                    paddingBottom: 0,
                    paddingLeft: 0,
                    paddingRight: 0,
                    marginTop: 0,
                    marginBottom: 0,
                    marginLeft: 0,
                    marginRight: 0,
                    border: { ...noBorder, style: "solid", width: 1, color: "#1f3a5f", radius: 8, top: true, bottom: true, left: true, right: true },
                },
            },
        },
    },
    {
        id: "enginecv-photo-header",
        name: "Photo Header",
        description: "A round photo beside your name and contact details, as many DACH and Balkan employers expect.",
        tags: ["Photo", "Europe", "Modern"],
        paperSize: "a4",
        settingsOverride: {
            theme: "modern",
            colors: {
                variant: "basic",
                accent: "#0e7490",
                text: "#0f172a",
                background: "#ffffff",
                applyTo: ["headings", "headingsLine", "dotsBarsBubbles", "headerIcons", "jobTitle"],
            },
            typography: { fontFamily: "Inter", fontSize: 10.5, lineHeight: 1.5 },
            spacing: { marginH: 18, marginV: 16, itemSpacing: 9 },
            header: {
                fontFamily: "Inter",
                fontSize: 30,
                fontWeight: "700",
                fontStyle: "normal",
                textDecoration: "none",
                textTransform: "none",
            },
            headings: {
                fontFamily: "Inter",
                fontSize: 11.5,
                fontWeight: "700",
                capitalization: "uppercase",
                letterSpacing: 1.2,
                textAlign: "left",
                style: "baseline",
                marginBottom: 10,
                paddingTop: 4,
                paddingBottom: 4,
                paddingLeft: 10,
                backgroundColor: "#ecfeff",
                border: { ...noBorder },
            },
            personalDetails: {
                alignment: "left",
                layout: "imageLeft",
                detailsLayout: "twoColumns",
                paddingTop: 0,
                paddingBottom: 12,
                paddingLeft: 0,
                paddingRight: 0,
                marginTop: 0,
                marginBottom: 12,
                marginLeft: 0,
                marginRight: 0,
                border: { ...noBorder, style: "solid", width: 1, color: "#cbd5e1", bottom: true },
                photo: {
                    width: 104,
                    height: 104,
                    paddingTop: 0,
                    paddingBottom: 0,
                    paddingLeft: 0,
                    paddingRight: 0,
                    marginTop: 0,
                    marginBottom: 0,
                    marginLeft: 0,
                    marginRight: 18,
                    border: { ...noBorder, style: "solid", width: 3, color: "#0e7490", radius: 999, top: true, bottom: true, left: true, right: true },
                },
            },
        },
    },
    {
        id: "enginecv-lebenslauf",
        name: "Lebenslauf",
        description: "German conventions: portrait photo, a date column for every station, and a place, date and signature line.",
        tags: ["Lebenslauf", "German", "Photo"],
        paperSize: "a4",
        settingsOverride: {
            theme: "modern",
            colors: {
                variant: "basic",
                accent: "#1e3a5f",
                text: "#111827",
                background: "#ffffff",
                applyTo: ["headings", "headingsLine", "dotsBarsBubbles"],
            },
            typography: { fontFamily: "Roboto", fontSize: 10.5, lineHeight: 1.45 },
            spacing: { marginH: 18, marginV: 14, itemSpacing: 9 },
            header: {
                fontFamily: "Roboto",
                fontSize: 28,
                fontWeight: "700",
                fontStyle: "normal",
                textDecoration: "none",
                textTransform: "none",
            },
            headings: {
                fontFamily: "Roboto",
                fontSize: 12,
                fontWeight: "700",
                capitalization: "capitalize",
                letterSpacing: 0,
                style: "baseline",
                marginBottom: 8,
                paddingTop: 3,
                paddingBottom: 3,
                paddingLeft: 8,
                backgroundColor: "#f1f5f9",
                border: { ...noBorder },
            },
            // Tabular dates: a fixed date column on the left of every entry.
            entryLayout: { layout: "contentRight", leftWidth: 24, titleFontSize: 10.5, subtitleFontSize: 10 },
            personalDetails: {
                alignment: "left",
                layout: "imageRight",
                detailsLayout: "twoColumns",
                paddingTop: 0,
                paddingBottom: 6,
                paddingLeft: 0,
                paddingRight: 0,
                marginTop: 0,
                marginBottom: 6,
                marginLeft: 0,
                marginRight: 0,
                border: { ...noBorder },
                // Bewerbungsfoto proportions (3:4 portrait).
                photo: {
                    width: 90,
                    height: 120,
                    paddingTop: 0,
                    paddingBottom: 0,
                    paddingLeft: 0,
                    paddingRight: 0,
                    marginTop: 0,
                    marginBottom: 0,
                    marginLeft: 16,
                    marginRight: 0,
                    border: { ...noBorder, style: "solid", width: 1, color: "#cbd5e1", radius: 2, top: true, bottom: true, left: true, right: true },
                },
            },
        },
    },
    {
        id: "enginecv-timeline",
        name: "Timeline",
        description: "Sky-blue chronological layout with a dashed left rule running through each section.",
        tags: ["Timeline", "Structured", "Chronological"],
        paperSize: "a4",
        settingsOverride: {
            theme: "modern",
            colors: {
                variant: "basic",
                accent: "#0284c7",
                text: "#111827",
                background: "#ffffff",
                applyTo: ["headings", "headingsLine", "dotsBarsBubbles", "dates", "jobTitle"],
            },
            typography: { fontFamily: "Inter", fontSize: 10.5, lineHeight: 1.5 },
            spacing: { marginH: 20, marginV: 15, itemSpacing: 8 },
            header: {
                fontFamily: "Inter",
                fontSize: 34,
                fontWeight: "700",
                fontStyle: "normal",
                textDecoration: "none",
                textTransform: "none",
            },
            headings: {
                fontFamily: "Inter",
                fontSize: 12,
                fontWeight: "700",
                capitalization: "uppercase",
                letterSpacing: 1,
                style: "baseline",
                marginBottom: 10,
                paddingBottom: 4,
                border: { ...noBorder, style: "solid", width: 1, color: "#0369a1", bottom: true },
            },
            personalDetails: {
                alignment: "left",
                layout: "imageRight",
                detailsLayout: "twoColumns",
                paddingTop: 0,
                paddingBottom: 10,
                paddingLeft: 0,
                paddingRight: 0,
                marginTop: 0,
                marginBottom: 12,
                marginLeft: 0,
                marginRight: 0,
                border: { ...noBorder, style: "solid", width: 2, color: "#0369a1", bottom: true },
            },
            contentStyle: {
                paddingTop: 2,
                paddingBottom: 2,
                paddingLeft: 10,
                paddingRight: 0,
                marginTop: 0,
                marginBottom: 0,
                marginLeft: 0,
                marginRight: 0,
                border: { ...noBorder, style: "dashed", width: 1, color: "#0369a1", left: true, dashLength: 4, dashGap: 4 },
                backgroundColor: "",
                preset: "plain",
            },
            entryLayout: {
                layout: "contentLeft",
                // In contentLeft, leftWidth is the content column; dates take the rest.
                leftWidth: 78,
                middleWidth: 58,
                rightWidth: 20,
                titleFontSize: 11,
                subtitleFontSize: 10,
                subtitleFontWeight: "600",
                subtitleFontStyle: "normal",
                subtitleTextDecoration: "none",
                subtitlePlacement: "nextLine",
                indentBody: false,
                listStyle: "bullet",
            },
        },
    },
    {
        id: "enginecv-executive",
        name: "Executive",
        description: "Navy serif with a centered header, spaced Playfair headings and generous leading.",
        tags: ["Executive", "Serif", "Senior"],
        paperSize: "a4",
        settingsOverride: {
            theme: "classic",
            colors: {
                variant: "basic",
                accent: "#0f2c4a",
                text: "#0b1220",
                background: "#ffffff",
                applyTo: ["name", "headings", "headingsLine", "dotsBarsBubbles", "jobTitle"],
            },
            typography: { fontFamily: "Source Serif Pro", fontSize: 10.5, lineHeight: 1.55 },
            spacing: { marginH: 22, marginV: 16, itemSpacing: 9 },
            header: {
                fontFamily: "Playfair Display",
                fontSize: 40,
                fontWeight: "700",
                fontStyle: "normal",
                textDecoration: "none",
                textTransform: "none",
            },
            headings: {
                fontFamily: "Playfair Display",
                fontSize: 12.5,
                fontWeight: "700",
                capitalization: "uppercase",
                letterSpacing: 3,
                textAlign: "center",
                style: "baseline",
                marginBottom: 10,
                paddingBottom: 5,
                border: { ...noBorder, style: "solid", width: 1, color: "#0f2c4a", bottom: true },
            },
            personalDetails: {
                alignment: "center",
                layout: "imageTop",
                detailsLayout: "wrap",
                paddingTop: 4,
                paddingBottom: 12,
                paddingLeft: 0,
                paddingRight: 0,
                marginTop: 0,
                marginBottom: 14,
                marginLeft: 0,
                marginRight: 0,
                border: { ...noBorder, style: "solid", width: 2, color: "#0f2c4a", bottom: true },
                photo: {
                    width: 100,
                    height: 100,
                    paddingTop: 0,
                    paddingBottom: 0,
                    paddingLeft: 0,
                    paddingRight: 0,
                    marginTop: 0,
                    marginBottom: 0,
                    marginLeft: 0,
                    marginRight: 14,
                    border: { ...noBorder, style: "solid", width: 2, color: "#0f2c4a", radius: 4, top: true, bottom: true, left: true, right: true },
                },
            },
        },
    },
    {
        id: "enginecv-developer",
        name: "Developer",
        description: "Mono headings and projects first, so your best work leads the page.",
        tags: ["Developer", "Mono", "Tech"],
        paperSize: "a4",
        settingsOverride: {
            theme: "modern",
            colors: {
                variant: "basic",
                accent: "#0d9488",
                text: "#1f2328",
                background: "#ffffff",
                applyTo: ["name", "headings", "headingsLine", "dotsBarsBubbles", "jobTitle", "headerIcons"],
            },
            typography: { fontFamily: "Inter", fontSize: 10.5, lineHeight: 1.5 },
            // Projects first: for developers the work itself is the strongest evidence.
            layout: {
                sectionOrder: ["projects", "experience", "skills", "education", "languages", "certificates"],
            },
            spacing: { marginH: 18, marginV: 16, itemSpacing: 10 },
            header: {
                fontFamily: "JetBrains Mono",
                fontSize: 28,
                fontWeight: "700",
                fontStyle: "normal",
                textDecoration: "none",
                textTransform: "none",
            },
            headings: {
                fontFamily: "JetBrains Mono",
                fontSize: 11,
                fontWeight: "700",
                capitalization: "uppercase",
                letterSpacing: 1,
                textAlign: "left",
                style: "baseline",
                marginBottom: 10,
                paddingTop: 4,
                paddingBottom: 4,
                paddingLeft: 10,
                backgroundColor: "#f0fdfa",
                border: { ...noBorder, style: "solid", width: 3, color: "#0d9488", left: true },
            },
            personalDetails: {
                alignment: "left",
                layout: "imageLeft",
                detailsLayout: "twoColumns",
                paddingTop: 0,
                paddingBottom: 10,
                paddingLeft: 0,
                paddingRight: 0,
                marginTop: 0,
                marginBottom: 12,
                marginLeft: 0,
                marginRight: 0,
                border: { ...noBorder, style: "solid", width: 1, color: "#0f766e", bottom: true },
            },
        },
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
