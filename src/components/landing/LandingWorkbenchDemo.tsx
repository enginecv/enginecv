"use client";

import { ChevronLeft, ChevronRight, LayoutTemplate, Maximize2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { useTemplateResume } from "@/components/templates/useTemplateResume";
import { Button } from "@/components/ui/button";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useTranslation } from "@/lib/i18n";
import { localizedPath } from "@/lib/i18n/locales";
import {
    getNextTemplateIndex,
    getPreviousTemplateIndex,
    getTemplateCounterParams,
    limitShowcaseTemplates,
    normalizeTemplateIndex,
} from "@/lib/landing-template-carousel";
import { getBuiltinTemplates } from "@/lib/templates/enginecv-templates";
import { GALLERY_PATH, gallerySlugForTemplate } from "@/lib/templates/gallery";
import { templateDisplayMeta } from "@/lib/templates/template-display";
import type { TemplateDocument } from "@/lib/templates/template-schema";

/** How long each template stays in the middle before the next one slides in. */
const AUTOPLAY_MS = 4500;
/** Embla scroll duration; higher is slower and softer. */
const SLIDE_DURATION = 34;
const PAGE_RATIO = 794 / 1123;
const LIGHTBOX_MS = 380;
// Widths of the WebP variants written by scripts/generate-template-previews.ts.
const WEBP_WIDTHS = [480, 960] as const;

function prefersReducedMotion() {
    return typeof window !== "undefined"
        && typeof window.matchMedia === "function"
        && window.matchMedia("(prefers-reduced-motion: reduce)")?.matches === true;
}

function PreviewPicture({
    template,
    name,
    sizes,
    eager,
    full,
    className,
}: {
    template: TemplateDocument;
    name: string;
    sizes: string;
    eager?: boolean;
    /** Use the full-size PNG only, for the enlarged view. */
    full?: boolean;
    className?: string;
}) {
    return (
        <picture className="block h-full w-full">
            {!full && (
                <source
                    type="image/webp"
                    srcSet={WEBP_WIDTHS.map((width) => `/template-previews/${template.id}-${width}.webp ${width}w`).join(", ")}
                    sizes={sizes}
                />
            )}
            <img
                src={`/template-previews/${template.id}.png`}
                alt={name}
                width={794}
                height={1123}
                loading={eager ? "eager" : "lazy"}
                decoding="async"
                draggable={false}
                className={className ?? "h-full w-full object-cover object-top"}
            />
        </picture>
    );
}

/**
 * Full-size view of one template. It grows out of the card that was clicked,
 * fades the page behind it, and can step through the other templates with the
 * arrow keys or buttons.
 */
function TemplateLightbox({
    open,
    template,
    name,
    originRect,
    onClose,
    onPrevious,
    onNext,
}: {
    open: boolean;
    template: TemplateDocument;
    name: string;
    originRect: DOMRect | null;
    onClose: () => void;
    onPrevious: () => void;
    onNext: () => void;
}) {
    const { t } = useTranslation();
    const [mounted, setMounted] = useState(false);
    const [shown, setShown] = useState(false);
    const dialogRef = useDialogFocus<HTMLDivElement>(open, onClose);

    // Where the page starts: the clicked card's position and size, so it grows out of it.
    const fromTransform = useMemo(() => {
        if (!open || !originRect || typeof window === "undefined") return "scale(0.92)";
        const finalHeight = Math.min(window.innerHeight * 0.9, (window.innerWidth * 0.94) / PAGE_RATIO);
        const finalWidth = finalHeight * PAGE_RATIO;
        const dx = originRect.left + originRect.width / 2 - window.innerWidth / 2;
        const dy = originRect.top + originRect.height / 2 - window.innerHeight / 2;
        return `translate(${dx}px, ${dy}px) scale(${originRect.width / finalWidth})`;
    }, [open, originRect]);

    // State changes happen in frame and timer callbacks: the first frame paints the
    // start position, the second releases it; on close the page stays rendered
    // until its exit transition has finished.
    useEffect(() => {
        if (open) {
            const frame = requestAnimationFrame(() => requestAnimationFrame(() => {
                setMounted(true);
                setShown(true);
            }));
            return () => cancelAnimationFrame(frame);
        }
        const frame = requestAnimationFrame(() => setShown(false));
        const timer = window.setTimeout(() => setMounted(false), LIGHTBOX_MS);
        return () => {
            cancelAnimationFrame(frame);
            window.clearTimeout(timer);
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "ArrowLeft") onPrevious();
            if (event.key === "ArrowRight") onNext();
        };
        window.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = previous;
            window.removeEventListener("keydown", onKey);
        };
    }, [open, onNext, onPrevious]);

    // Rendered while open too, so the dialog's focus and Escape handling find the element.
    if (!open && !mounted) return null;

    const easing = "cubic-bezier(0.22, 0.8, 0.2, 1)";
    return (
        <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={name}
            data-testid="landing-template-lightbox"
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
            onClick={onClose}
        >
            <div
                aria-hidden="true"
                className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity motion-reduce:transition-none"
                style={{ opacity: shown ? 1 : 0, transitionDuration: `${LIGHTBOX_MS}ms` }}
            />
            <div
                className="relative overflow-hidden rounded-md bg-white shadow-2xl transition-[transform,opacity] motion-reduce:transition-none"
                style={{
                    height: "min(90vh, calc(94vw / 0.7069))",
                    aspectRatio: "794 / 1123",
                    transform: shown ? "translate(0, 0) scale(1)" : fromTransform,
                    opacity: shown ? 1 : 0.4,
                    transitionDuration: `${LIGHTBOX_MS}ms`,
                    transitionTimingFunction: easing,
                }}
                onClick={(event) => event.stopPropagation()}
            >
                <PreviewPicture
                    key={template.id}
                    template={template}
                    name={name}
                    sizes="(min-width: 1024px) 640px, 94vw"
                    eager
                    full
                />
            </div>

            <div
                className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 p-4 transition-opacity motion-reduce:transition-none"
                style={{ opacity: shown ? 1 : 0, transitionDuration: `${LIGHTBOX_MS}ms` }}
                onClick={(event) => event.stopPropagation()}
            >
                <p className="truncate text-sm font-medium text-white/90">{name}</p>
                <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={t("common.close")}
                    onClick={onClose}
                    className="h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20 hover:text-white"
                >
                    <X className="h-5 w-5" aria-hidden="true" />
                </Button>
            </div>
            {([
                { side: "left", label: t("templates.showcase.previous"), onClick: onPrevious, Icon: ChevronLeft },
                { side: "right", label: t("templates.showcase.next"), onClick: onNext, Icon: ChevronRight },
            ] as const).map(({ side, label, onClick, Icon }) => (
                <Button
                    key={side}
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={label}
                    onClick={(event) => {
                        event.stopPropagation();
                        onClick();
                    }}
                    className={`absolute top-1/2 hidden h-11 w-11 -translate-y-1/2 rounded-full bg-white/10 text-white transition-opacity hover:bg-white/20 hover:text-white motion-reduce:transition-none sm:inline-flex ${side === "left" ? "left-4" : "right-4"}`}
                    style={{ opacity: shown ? 1 : 0, transitionDuration: `${LIGHTBOX_MS}ms` }}
                >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                </Button>
            ))}
        </div>
    );
}

/**
 * Hero template showcase: a carousel of the real template previews. The one in
 * the middle is full size and the others sit smaller and dimmed to either side.
 * It advances on its own, pauses while it is hovered, focused or enlarged, and
 * stays still for visitors who ask for reduced motion. Clicking the centred
 * template enlarges it; the button under it starts a resume from it.
 */
export function LandingWorkbenchDemo() {
    const { t, locale } = useTranslation();
    const templates = useMemo(() => limitShowcaseTemplates(getBuiltinTemplates()), []);
    const [api, setApi] = useState<CarouselApi>();
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [hovered, setHovered] = useState(false);
    const [enlarged, setEnlarged] = useState(false);
    const [originRect, setOriginRect] = useState<DOMRect | null>(null);
    const originIndexRef = useRef(0);
    const templateAction = useTemplateResume();
    const total = templates.length;
    const selectedTemplate = templates[selectedIndex];
    const counterParams = getTemplateCounterParams(selectedIndex, total);
    const reducedMotion = useMemo(() => prefersReducedMotion(), []);

    useEffect(() => {
        if (!api) return;
        const sync = () => setSelectedIndex(normalizeTemplateIndex(api.selectedScrollSnap(), total));
        sync();
        api.on("select", sync);
        api.on("reInit", sync);
        return () => {
            api.off("select", sync);
            api.off("reInit", sync);
        };
    }, [api, total]);

    // One timer per resting position, so any manual move restarts the countdown.
    useEffect(() => {
        if (!api || hovered || enlarged || reducedMotion || total < 2) return;
        const timer = window.setTimeout(() => {
            if (!document.hidden) api.scrollNext();
        }, AUTOPLAY_MS);
        return () => window.clearTimeout(timer);
    }, [api, hovered, enlarged, reducedMotion, selectedIndex, total]);

    const goTo = useCallback((index: number) => {
        api?.scrollTo(normalizeTemplateIndex(index, total));
    }, [api, total]);
    const goPrevious = useCallback(() => goTo(getPreviousTemplateIndex(selectedIndex, total)), [goTo, selectedIndex, total]);
    const goNext = useCallback(() => goTo(getNextTemplateIndex(selectedIndex, total)), [goTo, selectedIndex, total]);

    const openLightbox = (rect: DOMRect) => {
        originIndexRef.current = selectedIndex;
        setOriginRect(rect);
        setEnlarged(true);
    };

    if (!selectedTemplate) {
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
            className="min-w-0 overflow-hidden rounded-xl border border-edge-strong bg-surface-1 pb-6 pt-8 shadow-[0_20px_55px_rgba(0,0,0,0.2)]"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocus={() => setHovered(true)}
            onBlur={() => setHovered(false)}
        >
            <Carousel
                opts={{ loop: true, align: "center", duration: reducedMotion ? 0 : SLIDE_DURATION }}
                setApi={setApi}
                aria-label={t("nav.templates")}
                className="[mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]"
            >
                <CarouselContent className="-ml-3 pb-5 sm:-ml-6">
                    {templates.map((template, index) => {
                        const active = index === selectedIndex;
                        const slideName = templateDisplayMeta(template, t).name;
                        return (
                            <CarouselItem
                                key={template.id}
                                aria-label={`${index + 1} / ${total}`}
                                className="basis-[70%] pl-3 sm:basis-[46%] sm:pl-6 lg:basis-[38%] xl:basis-[46%]"
                            >
                                <button
                                    type="button"
                                    aria-label={active ? `${t("templates.showcase.enlarge")}: ${slideName}` : slideName}
                                    data-testid={active ? "landing-template-preview" : undefined}
                                    data-template-id={active ? template.id : undefined}
                                    data-template-theme={active ? template.settings.theme : undefined}
                                    data-template-accent={active ? template.settings.colors.accent : undefined}
                                    onClick={(event) => {
                                        if (active) openLightbox(event.currentTarget.getBoundingClientRect());
                                        else goTo(index);
                                    }}
                                    className={`group relative mx-auto block w-full origin-center overflow-hidden rounded-md border border-edge bg-white shadow-xl shadow-black/20 transition-[transform,opacity,box-shadow] duration-500 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1 ${
                                        active ? "scale-100 opacity-100" : "scale-[0.84] cursor-pointer opacity-45 hover:opacity-70"
                                    }`}
                                    style={{ aspectRatio: "794 / 1123" }}
                                >
                                    <PreviewPicture
                                        template={template}
                                        name={slideName}
                                        sizes="(min-width: 1280px) 400px, (min-width: 1024px) 38vw, (min-width: 640px) 46vw, 70vw"
                                        eager={index === 0}
                                    />
                                    {active && (
                                        <span
                                            aria-hidden="true"
                                            className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
                                        >
                                            <Maximize2 className="h-4 w-4" />
                                        </span>
                                    )}
                                </button>
                            </CarouselItem>
                        );
                    })}
                </CarouselContent>
            </Carousel>

            <div className="mx-auto mt-2 flex max-w-5xl flex-col gap-5 px-5 sm:flex-row sm:items-end sm:justify-between sm:px-8">
                <div className="min-w-0 text-center sm:text-left">
                    <p className="font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-[0.14em] text-faint">
                        {t("nav.templates")}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold tracking-tight text-strong">{name}</h2>
                    {slug ? (
                        <p className="mt-1.5 max-w-xl text-sm leading-6 text-mid">{t(`gallery.summary.${slug}`)}</p>
                    ) : null}
                </div>

                <div className="flex shrink-0 flex-col items-center gap-3 sm:items-end">
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            data-testid="landing-template-previous"
                            aria-label={t("templates.showcase.previous")}
                            onClick={goPrevious}
                            className="h-9 w-9"
                        >
                            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <span
                            data-testid="landing-template-counter"
                            className="min-w-[6.5rem] text-center font-[family-name:var(--font-geist-mono)] text-[11px] text-mid"
                        >
                            {t("templates.showcase.counter", counterParams)}
                        </span>
                        <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            data-testid="landing-template-next"
                            aria-label={t("templates.showcase.next")}
                            onClick={goNext}
                            className="h-9 w-9"
                        >
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        </Button>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link
                            href={localizedPath(GALLERY_PATH, locale)}
                            className="text-sm text-mid underline-offset-4 hover:text-strong hover:underline"
                        >
                            {t("gallery.backToAll")}
                        </Link>
                        <Button
                            type="button"
                            data-testid="landing-template-use-button"
                            disabled={templateAction.pendingTemplateId !== null}
                            onClick={() => void templateAction.useTemplate(selectedTemplate.id)}
                            aria-label={t("templates.use.named", { name })}
                        >
                            {templateAction.pendingTemplateId === selectedTemplate.id
                                ? t("templates.use.creating")
                                : t("landing.workbench.useTemplate")}
                        </Button>
                    </div>
                </div>
            </div>

            {templateAction.error && (
                <div
                    role="alert"
                    data-testid="landing-template-use-error"
                    className="mx-5 mt-4 flex items-start justify-between gap-3 rounded-md border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-danger-soft sm:mx-8"
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

            <TemplateLightbox
                open={enlarged}
                template={selectedTemplate}
                name={name}
                originRect={originIndexRef.current === selectedIndex ? originRect : null}
                onClose={() => setEnlarged(false)}
                onPrevious={goPrevious}
                onNext={goNext}
            />
        </aside>
    );
}
