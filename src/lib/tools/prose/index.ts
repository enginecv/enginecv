import type { ToolSlug } from "../registry";
import { prose as cefr } from "./cefr-level";
import { prose as europass } from "./europass-to-cv";
import { prose as github } from "./github-to-cv";
import { prose as jsonResume } from "./json-resume-editor";
import { prose as linkedin } from "./linkedin-to-cv";
import type { ToolProse } from "./types";

export type { ToolProse } from "./types";

const TOOL_PROSE: Record<ToolSlug, ToolProse> = {
    "europass-to-cv": europass,
    "linkedin-to-cv": linkedin,
    "github-to-cv": github,
    "json-resume-editor": jsonResume,
    "cefr-level": cefr,
};

/**
 * Section headings shared by every tool. They live here, with the English text
 * they introduce, and not in the component or the translation files: the whole
 * deep-dive is English only for now.
 */
export const TOOL_PROSE_HEADINGS = {
    about: "About this tool",
    privacy: "What happens to your data",
    limits: "Limits worth knowing",
} as const;

/** The long-form English text for a tool, or undefined for an unknown slug. */
export function getToolProse(slug: string): ToolProse | undefined {
    return (TOOL_PROSE as Record<string, ToolProse | undefined>)[slug];
}

/** Every paragraph of a tool's long-form text, in reading order. Used by the content tests. */
export function toolProseParagraphs(prose: ToolProse): string[] {
    return [
        ...prose.overview,
        ...prose.formats.map((format) => `${format.name}. ${format.detail}`),
        ...prose.privacy,
        ...prose.limits,
    ];
}
