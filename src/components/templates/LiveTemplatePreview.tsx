"use client";

import { useMemo } from "react";
import { LiveResumeThumbnail } from "@/components/dashboard/LiveResumeThumbnail";
import { getTemplatePreviewOptions } from "@/lib/templates/enginecv-templates";
import { applyTemplateToResume } from "@/lib/templates/template-apply";
import { getSampleResumeForTemplatePreview } from "@/lib/templates/template-preview";
import { templateDocumentSchema, type TemplateDocument } from "@/lib/templates/template-schema";

/**
 * The template itself, drawn with the real resume renderer on sample content. Used where
 * no pre-rendered image exists (templates the person made), so the card shows the actual
 * design rather than a generic placeholder.
 */
export function LiveTemplatePreview({ template }: { template: TemplateDocument }) {
    const preview = useMemo(() => {
        // Saved templates can predate newer settings, so fill the gaps the way "Use template" does.
        const parsed = templateDocumentSchema.safeParse(template);
        if (!parsed.success) return null;
        const applied = applyTemplateToResume(getSampleResumeForTemplatePreview(getTemplatePreviewOptions(template.id)), parsed.data, { applyPaperSize: true });
        return { resume: applied.resume, paperSize: applied.paperSize ?? "a4" };
    }, [template]);

    return preview ? <LiveResumeThumbnail resume={preview.resume} paperSize={preview.paperSize} /> : null;
}
