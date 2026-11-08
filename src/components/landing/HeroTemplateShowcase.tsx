"use client";

import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, LayoutTemplate } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    type CarouselApi,
} from "@/components/ui/carousel";
import { TemplatePreviewCard } from "@/components/templates/TemplatePreviewCard";
import { useTemplateResume } from "@/components/templates/useTemplateResume";
import { useTranslation } from "@/lib/i18n";
import {
    getNextTemplateIndex,
    getPreviousTemplateIndex,
    getTemplateCounterParams,
    limitShowcaseTemplates,
    normalizeTemplateIndex,
} from "@/lib/landing-template-carousel";
import { getBuiltinTemplates } from "@/lib/templates/enginecv-templates";

export function HeroTemplateShowcase() {
    const { t } = useTranslation();
    const templates = useMemo(() => limitShowcaseTemplates(getBuiltinTemplates()), []);
    const [api, setApi] = useState<CarouselApi>();
    const [selectedIndex, setSelectedIndex] = useState(0);
    const templateAction = useTemplateResume();
    const total = templates.length;
    const counterParams = getTemplateCounterParams(selectedIndex, total);
    const hasTemplates = total > 0;

    const syncSelected = useCallback(() => {
        if (!api) return;
        setSelectedIndex(normalizeTemplateIndex(api.selectedScrollSnap(), total));
    }, [api, total]);

    useEffect(() => {
        if (!api) return;
        api.on("select", syncSelected);
        api.on("reInit", syncSelected);
        return () => {
            api.off("select", syncSelected);
            api.off("reInit", syncSelected);
        };
    }, [api, syncSelected]);

    const scrollToIndex = useCallback((index: number) => {
        const nextIndex = normalizeTemplateIndex(index, total);
        setSelectedIndex(nextIndex);
        api?.scrollTo(nextIndex);
    }, [api, total]);

    const scrollPrevious = useCallback(() => {
        scrollToIndex(getPreviousTemplateIndex(selectedIndex, total));
    }, [scrollToIndex, selectedIndex, total]);

    const scrollNext = useCallback(() => {
        scrollToIndex(getNextTemplateIndex(selectedIndex, total));
    }, [scrollToIndex, selectedIndex, total]);

    if (!hasTemplates) {
        return (
            <aside
                data-testid="landing-template-showcase"
                className="mx-auto w-full max-w-md rounded-2xl border border-dashed border-edge bg-surface-4/70 p-6 text-center lg:mx-0"
            >
                <LayoutTemplate className="mx-auto h-8 w-8 text-accent" aria-hidden="true" />
                <h2 className="mt-4 text-lg font-semibold text-strong">
                    {t("templates.showcase.emptyTitle")}
                </h2>
                <p className="mt-2 text-sm leading-6 text-mid">
                    {t("templates.showcase.emptyDescription")}
                </p>
                <Link
                    href="/dashboard?tab=templates"
                    className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-accent hover:text-accent-soft"
                >
                    {t("hero.viewTemplates")}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
            </aside>
        );
    }

    return (
        <aside
            data-testid="landing-template-showcase"
            className="mx-auto w-full max-w-[320px] min-w-0 lg:mx-0 lg:max-w-[420px] xl:max-w-[450px] 2xl:max-w-[510px]"
        >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div
                    data-testid="landing-template-counter"
                    className="rounded-full border border-edge bg-surface-4/90 px-3 py-1.5 text-sm font-medium text-bright"
                >
                    {t("templates.showcase.counter", counterParams)}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        data-testid="landing-template-previous"
                        aria-label={t("templates.showcase.previous")}
                        onClick={scrollPrevious}
                        className="inline-flex h-11 w-11 touch-manipulation items-center justify-center rounded-full border border-edge bg-surface-4 text-strong transition-colors hover:border-faint hover:bg-edge"
                    >
                        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        data-testid="landing-template-next"
                        aria-label={t("templates.showcase.next")}
                        onClick={scrollNext}
                        className="inline-flex h-11 w-11 touch-manipulation items-center justify-center rounded-full border border-edge bg-surface-4 text-strong transition-colors hover:border-faint hover:bg-edge"
                    >
                        <ChevronRight className="h-5 w-5" aria-hidden="true" />
                    </button>
                </div>
            </div>

            <Carousel
                setApi={setApi}
                opts={{
                    align: "start",
                    loop: true,
                }}
                className="min-w-0"
            >
                <CarouselContent>
                    {templates.map((template, index) => (
                        <CarouselItem
                            key={template.id}
                            aria-hidden={selectedIndex !== index}
                            data-selected={selectedIndex === index ? "true" : "false"}
                        >
                            <TemplatePreviewCard
                                template={template}
                                onClick={() => void templateAction.useTemplate(template.id)}
                                actionLabel={t("templates.use.named", { name: template.meta.name })}
                                loadingLabel={t("templates.use.creating")}
                                loading={templateAction.pendingTemplateId === template.id}
                                disabled={selectedIndex !== index || templateAction.pendingTemplateId !== null}
                                variant="hero"
                                priority={index === 0}
                                showName
                                testId="landing-template-preview"
                            />
                        </CarouselItem>
                    ))}
                </CarouselContent>
            </Carousel>
            {templateAction.error && (
                <div
                    role="alert"
                    data-testid="landing-template-use-error"
                    className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-danger-soft"
                >
                    <span>{templateAction.error}</span>
                    <button
                        type="button"
                        onClick={templateAction.clearError}
                        className="shrink-0 text-xs font-semibold text-danger-soft underline underline-offset-2"
                    >
                        {t("templates.use.dismissError")}
                    </button>
                </div>
            )}
        </aside>
    );
}
