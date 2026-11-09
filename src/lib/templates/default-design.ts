import { createEmptyResume, type Resume } from "../schema";
import { getBuiltinTemplateById } from "./enginecv-templates";
import { applyTemplateToResume } from "./template-apply";

/** Built-in template every new resume starts from, however it is created. */
export const DEFAULT_TEMPLATE_ID = "enginecv-modern";

/**
 * Gives a resume the default template's design (type, colours, spacing, header,
 * headings, layout) and keeps everything else: its content, language, section
 * set and per-section display choices. Falls back to the resume unchanged if the
 * template is ever missing.
 */
export function withDefaultDesign(resume: Resume): Resume {
    const template = getBuiltinTemplateById(DEFAULT_TEMPLATE_ID);
    return template ? applyTemplateToResume(resume, template).resume : resume;
}

/** A blank resume with the default template's design, for every "new resume" path. */
export function createNewResume(): Resume {
    return withDefaultDesign(createEmptyResume());
}
