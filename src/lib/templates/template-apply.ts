import { type Resume } from "../schema";
import { type TemplateDocument } from "./template-schema";

export type TemplateApplyResult = {
    resume: Resume;
    /** Set when the caller asked to apply paperSize; otherwise undefined. */
    paperSize?: "a4" | "letter";
};

/**
 * Rules for applying a template to a resume.
 * Visual settings come from the template; content, history, and user/environment
 * preferences (language, dateFormat, measurementSystem, ai) stay on the resume.
 *
 * `paperSize` is stored on the editor store (not on the Resume), so the caller
 * decides whether to apply it via `options.applyPaperSize`.
 */
export function applyTemplateToResume(
    resume: Resume,
    template: TemplateDocument,
    options: { applyPaperSize?: boolean } = {},
): TemplateApplyResult {
    const tplSettings = template.settings;
    const cur = resume.settings;

    const mergedLayout = mergeLayout(cur.layout, tplSettings.layout, cur.contentSections);

    const nextSettings: Resume["settings"] = {
        // Excluded fields keep current values.
        language: cur.language,
        dateFormat: cur.dateFormat,
        measurementSystem: cur.measurementSystem,
        nationalityDisplay: cur.nationalityDisplay,
        nationalityNameStyle: cur.nationalityNameStyle,
        licenseDisplay: cur.licenseDisplay,
        passportDisplay: cur.passportDisplay,
        nationalIdDisplay: cur.nationalIdDisplay,
        phoneDisplay: cur.phoneDisplay,
        visaDisplay: cur.visaDisplay,
        militaryServiceDisplay: cur.militaryServiceDisplay,
        languagesSection: cur.languagesSection,
        ai: cur.ai,

        // Preserve current resume's content section set and visibility; do not
        // let templates add, remove, or unhide user content sections.
        contentSections: cur.contentSections,
        hiddenSections: cur.hiddenSections,

        // Apply visual fields from template.
        theme: tplSettings.theme,
        sectionDisplay: filterSectionDisplay(tplSettings.sectionDisplay, cur.contentSections, cur.sectionDisplay),
        layout: mergedLayout,
        typography: tplSettings.typography,
        spacing: tplSettings.spacing,
        colors: tplSettings.colors,
        headings: tplSettings.headings,
        contentStyle: tplSettings.contentStyle,
        header: tplSettings.header,
        customFonts: mergeCustomFonts(cur.customFonts, tplSettings.customFonts),
        linkIcon: tplSettings.linkIcon,
        headerIcon: tplSettings.headerIcon,
        personalDetails: tplSettings.personalDetails,
        entryLayout: tplSettings.entryLayout,
        repoBadge: tplSettings.repoBadge,
        footer: tplSettings.footer,
        design: tplSettings.design,
    };

    const nextResume: Resume = {
        ...resume,
        settings: nextSettings,
    };

    return {
        resume: nextResume,
        paperSize: options.applyPaperSize ? template.paperSize : undefined,
    };
}

function mergeLayout(
    cur: Resume["settings"]["layout"],
    tpl: Resume["settings"]["layout"],
    contentSections: string[],
): Resume["settings"]["layout"] {
    const knownKeys = new Set<string>([
        "experience", "education", "certificates", "projects", "skills", "languages",
        ...contentSections,
    ]);

    const sectionOrder = mergeSectionOrder(cur.sectionOrder, tpl.sectionOrder, knownKeys);
    const sectionPlacement = filterSectionPlacement(tpl.sectionPlacement, knownKeys, cur.sectionPlacement);

    return {
        columns: tpl.columns,
        headerPosition: tpl.headerPosition,
        leftColumnWidth: tpl.leftColumnWidth,
        sectionOrder,
        sectionPlacement,
    };
}

function mergeSectionOrder(curOrder: string[], tplOrder: string[], knownKeys: Set<string>): string[] {
    const result: string[] = [];
    const seen = new Set<string>();

    for (const key of tplOrder) {
        if (!knownKeys.has(key)) continue;
        if (seen.has(key)) continue;
        result.push(key);
        seen.add(key);
    }

    for (const key of curOrder) {
        if (!knownKeys.has(key)) continue;
        if (seen.has(key)) continue;
        result.push(key);
        seen.add(key);
    }

    return result;
}

function filterSectionPlacement(
    tplPlacement: Record<string, "left" | "right" | "full">,
    knownKeys: Set<string>,
    fallback: Record<string, "left" | "right" | "full">,
): Record<string, "left" | "right" | "full"> {
    const out: Record<string, "left" | "right" | "full"> = {};
    for (const [key, value] of Object.entries(tplPlacement)) {
        if (knownKeys.has(key)) out[key] = value;
    }
    // Preserve any current placements for keys the template did not touch.
    for (const [key, value] of Object.entries(fallback)) {
        if (knownKeys.has(key) && !(key in out)) out[key] = value;
    }
    return out;
}

function filterSectionDisplay(
    tplDisplay: Resume["settings"]["sectionDisplay"],
    contentSections: string[],
    fallback: Resume["settings"]["sectionDisplay"],
): Resume["settings"]["sectionDisplay"] {
    const knownKeys = new Set<string>([
        "experience", "education", "certificates", "projects", "skills", "languages",
        ...contentSections,
    ]);
    const out: Resume["settings"]["sectionDisplay"] = {};
    for (const [key, value] of Object.entries(tplDisplay)) {
        if (knownKeys.has(key)) out[key] = value;
    }
    for (const [key, value] of Object.entries(fallback)) {
        if (knownKeys.has(key) && !(key in out)) out[key] = value;
    }
    return out;
}

function mergeCustomFonts(
    cur: Resume["settings"]["customFonts"],
    tpl: Resume["settings"]["customFonts"],
): Resume["settings"]["customFonts"] {
    const byName = new Map<string, { name: string; url: string }>();
    for (const font of cur) byName.set(font.name, font);
    for (const font of tpl) byName.set(font.name, font);
    return Array.from(byName.values());
}
