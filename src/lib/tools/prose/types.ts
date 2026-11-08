import type { ToolSlug } from "../registry";

/**
 * Long-form English text for one tool page. It sits beside the tool's
 * translated intro, steps and FAQ (which stay in the translation files) and is
 * shown on the English page only, so it is not part of the locale-parity set.
 */
export interface ToolProse {
    slug: ToolSlug;
    /** What the tool is for and what it produces, as paragraphs. */
    overview: string[];
    /** Heading for `formats`, since "what goes in" differs by tool. */
    formatsHeading: string;
    /** Inputs and outputs in detail: one entry per file type or kind of input. */
    formats: { name: string; detail: string }[];
    /** What happens to the user's data, accurate for this tool. */
    privacy: string[];
    /** Known limitations, specific and honest. */
    limits: string[];
}
