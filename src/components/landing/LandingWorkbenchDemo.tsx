"use client";

import { ChevronLeft, ChevronRight, LayoutTemplate } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ResumePreview } from "@/components/editor/ResumePreview";
import { useTemplateResume } from "@/components/templates/useTemplateResume";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { localizedPath } from "@/lib/i18n/locales";
import {
    getNextTemplateIndex,
    getPreviousTemplateIndex,
    getTemplateCounterParams,
    limitShowcaseTemplates,
    normalizeTemplateIndex,
} from "@/lib/landing-template-carousel";
import { getBuiltinTemplates, getTemplatePreviewOptions } from "@/lib/templates/enginecv-templates";
import { GALLERY_PATH, gallerySlugForTemplate } from "@/lib/templates/gallery";
import { applyTemplateToResume } from "@/lib/templates/template-apply";
import { templateDisplayMeta } from "@/lib/templates/template-display";
import { getSampleResumeForTemplatePreview } from "@/lib/templates/template-preview";

/**
 * Hero template showcase: one real template preview at a time, with the
 * template's name and a one-line description, previous/next controls and a
 * button that starts a resume from it. The preview is the same renderer the
 * editor uses, fed the same sample resume as the template gallery.
 */
export function LandingWorkbenchDemo() {
    const { t, locale } = useTranslation();
    const templates = useMemo(() => limitShowcaseTemplates(getBuiltinTemplates()), []);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const templateAction = useTemplateResume();
    const total = templates.length;
    const selectedTemplate = templates[selectedIndex];
    const counterParams = getTemplateCounterParams(selectedIndex, total);

    const demoResume = useMemo(() => {
        if (!selectedTemplate) return null;
        const sample = getSampleResumeForTemplatePreview(getTemplatePreviewOptions(selectedTemplate.id));
        return applyTemplateToResume(sample, selectedTemplate).resume;
    }, [selectedTemplate]);

    const selectTemplate = (index: number) => setSelectedIndex(normalizeTemplateIndex(index, total));

    if (!selectedTemplate || !demoResume) {
        return (
            <aside
                data-testid="landing-template-showcase"
                className="flex min-h-96 items-center justify-center border border-dashed border-edge bg-surface-1 p-8 text-center"
            >
                <div>
                    <LayoutTemplate className="mx-auto h-8 w-8 text-accent" aria-hidden="true" />
                    <h2 className="mt-4 text-lg font-semibold text-strong">
                        {t("templates.showcase.emptyTitle")}
                    </h2>
                    <p className="mt-2 max-w-sm text-sm leading-6 text-mid">
                        {t("templates.showcase.emptyDescription")}
                    </p>
                </div>
            </aside>
        );
    }

    const name = templateDisplayMeta(selectedTemplate, t).name;
    const slug = gallerySlugForTemplate(selectedTemplate.id);

    return (
        <aside
            data-testid="landing-template-showcase"
            data-selected="true"
            aria-hidden="false"
            className="min-w-0 overflow-hidden rounded-xl border border-edge-strong bg-surface-1 shadow-[0_20px_55px_rgba(0,0,0,0.2)]"
        >
            <p className="sr-only" aria-live="polite">
                {t("landing.workbench.previewLabel")}: {name}
            </p>

            <div className="grid min-w-0 lg:grid-cols-[260px_minmax(0,1fr)]">
                <div className="flex flex-col border-b border-edge bg-surface-2 p-5 lg:border-b-0 lg:border-r">
                    <p className="font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-[0.14em] text-faint">
                        {t("nav.templates")}
                    </p>
                    <h2 className="mt-2 text-xl font-semibold tracking-tight text-strong">{name}</h2>
                    {slug ? (
                        <p className="mt-2 text-sm leading-6 text-mid">{t(`gallery.summary.${slug}`)}</p>
                    ) : null}

                    <div className="mt-auto pt-6">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <span
                                data-testid="landing-template-counter"
                                className="font-[family-name:var(--font-geist-mono)] text-[11px] text-mid"
                            >
                                {t("templates.showcase.counter", counterParams)}
                            </span>
                            <div className="flex gap-1">
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    data-testid="landing-template-previous"
                                    aria-label={t("templates.showcase.previous")}
                                    onClick={() => selectTemplate(getPreviousTemplateIndex(selectedIndex, total))}
                                    className="h-8 w-8"
                                >
                                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                                </Button>
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    data-testid="landing-template-next"
                                    aria-label={t("templates.showcase.next")}
                                    onClick={() => selectTemplate(getNextTemplateIndex(selectedIndex, total))}
                                    className="h-8 w-8"
                                >
                                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                                </Button>
                            </div>
                        </div>
                        <Button
                            type="button"
                            data-testid="landing-template-use-button"
                            disabled={templateAction.pendingTemplateId !== null}
                            onClick={() => void templateAction.useTemplate(selectedTemplate.id)}
                            aria-label={t("templates.use.named", { name })}
                            className="w-full"
                        >
                            {templateAction.pendingTemplateId === selectedTemplate.id
                                ? t("templates.use.creating")
                                : t("landing.workbench.useTemplate")}
                        </Button>
                        <Link
                            href={localizedPath(GALLERY_PATH, locale)}
                            className="mt-3 block text-center text-sm text-mid underline-offset-4 hover:text-strong hover:underline"
                        >
                            {t("gallery.backToAll")}
                        </Link>
                    </div>
                </div>

                <div className="relative min-w-0 bg-surface-3">
                    <div
                        data-testid="landing-template-preview"
                        data-template-id={selectedTemplate.id}
                        data-template-theme={selectedTemplate.settings.theme}
                        data-template-accent={selectedTemplate.settings.colors.accent}
                        className="relative h-[400px] min-w-0 overflow-hidden bg-surface-3 sm:h-[490px] lg:h-[550px]"
                    >
                        <div className="absolute left-1/2 top-6 h-[1123px] w-[794px] origin-top -translate-x-1/2 scale-[0.32] sm:scale-[0.4] lg:scale-[0.46]">
                            <ResumePreview
                                resumeOverride={demoResume}
                                paperSizeOverride={selectedTemplate.paperSize}
                                thumbnailMode
                            />
                        </div>
                    </div>
                </div>
            </div>

            {templateAction.error && (
                <div
                    role="alert"
                    data-testid="landing-template-use-error"
                    className="flex items-start justify-between gap-3 border-t border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-danger-soft"
                >
                    <span>{templateAction.error}</span>
                    <button
                        type="button"
                        onClick={templateAction.clearError}
                        className="shrink-0 text-xs font-semibold underline underline-offset-2"
                    >
                        {t("templates.use.dismissError")}
                    </button>
                </div>
            )}
        </aside>
    );
}
