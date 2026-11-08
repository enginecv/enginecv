import { CV_LANGUAGE_OPTIONS } from "@/lib/cv-language";
import type { Resume } from "@/lib/schema";
import { getBuiltinTemplateById, isBuiltinTemplateId, resolveBuiltinTemplateId } from "@/lib/templates/enginecv-templates";
import { applyTemplateToResume } from "@/lib/templates/template-apply";
import { NoticeList, type PathSegment } from "./notices";
import { DESIGN_FIELDS } from "./schema";

/** What the design hints actually changed, for the import summary. */
export interface DesignApplied {
    template?: string;
    accent?: string;
    cvLanguage?: string;
}

export const ACCENT_PATTERN = /^#[0-9a-fA-F]{6}$/;

function resolveTemplateId(raw: string): string | undefined {
    const text = raw.trim();
    if (!text) return undefined;
    for (const candidate of [text, text.toLowerCase(), `enginecv-${text.toLowerCase()}`]) {
        if (isBuiltinTemplateId(candidate)) return resolveBuiltinTemplateId(candidate);
    }
    return undefined;
}

function resolveCvLanguage(raw: string): string | undefined {
    const text = raw.trim().toLowerCase();
    return CV_LANGUAGE_OPTIONS.find((option) => option.value.toLowerCase() === text)?.value;
}

/**
 * Applies `design.template`, then `design.accent` (so a template's colours do
 * not overwrite it), then `design.cvLanguage`. Anything unknown or invalid is
 * ignored with a notice; hints never block an import.
 */
export function applyDesignHints(
    resume: Resume,
    design: unknown,
    notices: NoticeList,
): { resume: Resume; applied: DesignApplied } {
    const applied: DesignApplied = {};
    const path: PathSegment[] = ["design"];
    if (design === undefined || design === null) return { resume, applied };
    if (typeof design !== "object" || Array.isArray(design)) {
        notices.add("skipped", "value-invalid", path);
        return { resume, applied };
    }

    const hints = design as Record<string, unknown>;
    let next = resume;

    for (const key of Object.keys(hints)) {
        if (!(DESIGN_FIELDS as readonly string[]).includes(key)) {
            notices.add("skipped", "design-hint-unknown", [...path, key], { key });
        }
    }

    if (hints.template !== undefined) {
        const raw = String(hints.template);
        const id = typeof hints.template === "string" ? resolveTemplateId(raw) : undefined;
        const template = id ? getBuiltinTemplateById(id) : undefined;
        if (id && template) {
            next = applyTemplateToResume(next, template).resume;
            applied.template = id;
        } else {
            notices.add("skipped", "template-unknown", [...path, "template"], { value: raw });
        }
    }

    if (hints.accent !== undefined) {
        const raw = String(hints.accent).trim();
        if (typeof hints.accent === "string" && ACCENT_PATTERN.test(raw)) {
            next = { ...next, settings: { ...next.settings, colors: { ...next.settings.colors, accent: raw } } };
            applied.accent = raw;
        } else {
            notices.add("skipped", "accent-invalid", [...path, "accent"], { value: raw });
        }
    }

    if (hints.cvLanguage !== undefined) {
        const raw = String(hints.cvLanguage);
        const language = typeof hints.cvLanguage === "string" ? resolveCvLanguage(raw) : undefined;
        if (language) {
            next = { ...next, settings: { ...next.settings, language } };
            applied.cvLanguage = language;
        } else {
            notices.add("skipped", "cv-language-unknown", [...path, "cvLanguage"], { value: raw });
        }
    }

    return { resume: next, applied };
}
