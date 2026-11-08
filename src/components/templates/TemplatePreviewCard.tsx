"use client";

import { templateDisplayMeta } from "@/lib/templates/template-display";
import { useTranslation } from "@/lib/i18n";
import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import type { TemplateDocument } from "@/lib/templates/template-schema";

const SAMPLE_SECTIONS = [
    { label: "Experience", lines: [100, 86, 64, 72] },
    { label: "Education", lines: [100, 78] },
    { label: "Projects", lines: [92, 74, 58] },
    { label: "Skills", lines: [100, 72, 56] },
];

// Widths of the WebP variants written by scripts/generate-template-previews.ts.
const TEMPLATE_PREVIEW_WIDTHS = [480, 960] as const;

type TemplatePreviewCardProps = {
    template: TemplateDocument;
    href?: string;
    onClick?: () => void;
    actionLabel?: string;
    loadingLabel?: string;
    disabled?: boolean;
    loading?: boolean;
    variant?: "hero" | "catalog" | "compact";
    className?: string;
    showName?: boolean;
    testId?: string;
    /** Load eagerly at high priority. Set it on the one card that can be the LCP element. */
    priority?: boolean;
};

function cx(...classes: Array<string | undefined | false | null>) {
    return classes.filter(Boolean).join(" ");
}

export function TemplatePreviewCard({
    template,
    href,
    onClick,
    actionLabel,
    loadingLabel,
    disabled = false,
    loading = false,
    variant = "catalog",
    className,
    showName = true,
    testId,
    priority = false,
}: TemplatePreviewCardProps) {
    const meta = templateDisplayMeta(template, useTranslation().t);
    const preview = <TemplatePreviewBody template={template} variant={variant} priority={priority} />;

    return (
        <div
            className={cx("group min-w-0", className)}
            data-testid={testId}
            data-template-id={template.id}
            data-template-theme={template.settings.theme}
            data-template-accent={template.settings.colors.accent}
        >
            {onClick ? (
                <button
                    type="button"
                    onClick={onClick}
                    disabled={disabled || loading}
                    data-testid="landing-template-use-button"
                    className="relative block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-surface-2 disabled:cursor-wait disabled:opacity-80"
                    aria-label={actionLabel ?? meta.name}
                >
                    {preview}
                    {loading && (
                        <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-surface-2/80 px-4 text-center text-sm font-semibold text-strong">
                            {loadingLabel}
                        </span>
                    )}
                </button>
            ) : href ? (
                <Link
                    href={href}
                    data-testid="landing-template-preview-link"
                    className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-surface-2"
                    aria-label={meta.name}
                >
                    {preview}
                </Link>
            ) : (
                preview
            )}
            {showName && (
                <p className="mt-3 truncate text-center text-sm font-medium text-mid transition-colors group-hover:text-strong">
                    {meta.name}
                </p>
            )}
        </div>
    );
}

function TemplatePreviewBody({
    template,
    variant,
    priority,
}: {
    template: TemplateDocument;
    variant: "hero" | "catalog" | "compact";
    priority: boolean;
}) {
    const meta = templateDisplayMeta(template, useTranslation().t);
    const isHero = variant === "hero";
    const s = template.settings;
    const bg = s.colors.background || "#ffffff";
    const text = s.colors.text || "#111827";
    const bodyFont = s.typography.fontFamily || "Inter";
    const [snapshotFailed, setSnapshotFailed] = useState(false);

    const wrapperClass = cx(
        "mx-auto overflow-hidden rounded-2xl border border-edge shadow-2xl shadow-black/25 transition-transform duration-300 group-hover:-translate-y-1",
        isHero
            ? "h-[330px] w-full max-w-[245px] sm:h-[383px] sm:max-w-[276px] lg:h-[521px] lg:max-w-[399px] xl:h-[598px] xl:max-w-[429px] 2xl:h-[660px] 2xl:max-w-[483px]"
            : variant === "compact"
                ? "h-[300px] w-[220px] sm:h-[340px] sm:w-[250px]"
                : "aspect-[0.72] h-auto min-h-[320px] w-full max-w-[280px]",
    );

    const sizes = isHero
        ? "(min-width: 1536px) 483px, (min-width: 1280px) 429px, (min-width: 1024px) 399px, (min-width: 640px) 276px, 245px"
        : variant === "compact"
            ? "(min-width: 640px) 250px, 220px"
            : "280px";

    if (!snapshotFailed) {
        return (
            <div className={wrapperClass} style={{ backgroundColor: bg }}>
                {/* Pre-sized WebP with the full PNG as fallback. The previews skip the
                    Next image optimizer, so the sized variants are generated ahead. */}
                <picture className="block h-full w-full">
                    <source
                        type="image/webp"
                        srcSet={TEMPLATE_PREVIEW_WIDTHS.map((width) => `/template-previews/${template.id}-${width}.webp ${width}w`).join(", ")}
                        sizes={sizes}
                    />
                    <img
                        src={`/template-previews/${template.id}.png`}
                        alt={meta.name}
                        width={794}
                        height={1123}
                        className="h-full w-full object-cover object-top"
                        onError={() => setSnapshotFailed(true)}
                        loading={priority ? "eager" : "lazy"}
                        fetchPriority={priority ? "high" : "auto"}
                        decoding="async"
                    />
                </picture>
            </div>
        );
    }

    return (
        <SkeletonBody template={template} variant={variant} wrapperClass={wrapperClass} bg={bg} text={text} bodyFont={bodyFont} />
    );
}

function SkeletonBody({
    template,
    variant,
    wrapperClass,
    bg,
    text,
    bodyFont,
}: {
    template: TemplateDocument;
    variant: "hero" | "catalog" | "compact";
    wrapperClass: string;
    bg: string;
    text: string;
    bodyFont: string;
}) {
    const s = template.settings;
    const accent = s.colors.accent || "#ffaa8d";
    const headingFont = s.headings.fontFamily || bodyFont;
    const headerFont = s.header.fontFamily || bodyFont;
    const headerTextTransform = s.header.textTransform;
    const headingsCap = s.headings.capitalization;
    const headingBorder = s.headings.border;
    const isTwoCol = s.layout.columns === "two";
    const isHero = variant === "hero";

    const headingBorderStyle = useMemo<CSSProperties>(() => {
        const style: CSSProperties = {};
        const color = s.headings.borderColor || headingBorder.color || accent;
        const width = headingBorder.width || 1;
        const css = `${width}px ${headingBorder.style} ${color}`;
        if (headingBorder.top) style.borderTop = css;
        if (headingBorder.bottom) style.borderBottom = css;
        if (headingBorder.left) style.borderLeft = css;
        if (headingBorder.right) style.borderRight = css;
        return style;
    }, [accent, headingBorder, s.headings.borderColor]);

    return (
        <div
            className={wrapperClass}
            style={{ backgroundColor: bg, color: text, fontFamily: bodyFont }}
        >
            <div className={cx("flex h-full flex-col", isHero ? "p-5 sm:p-6" : "p-4")}>
                <div className={cx(isHero ? "mb-5" : "mb-3")}>
                    <div
                        style={{
                            fontFamily: headerFont,
                            fontSize: isHero ? 21 : 14,
                            fontWeight: Number(s.header.fontWeight) || 700,
                            fontStyle: s.header.fontStyle,
                            textTransform: headerTextTransform === "none" ? undefined : (headerTextTransform as CSSProperties["textTransform"]),
                            lineHeight: 1.05,
                        }}
                    >
                        Alex Carter
                    </div>
                    <div style={{ fontSize: isHero ? 10 : 7, opacity: 0.58, marginTop: isHero ? 5 : 2 }}>
                        Senior Product Designer
                    </div>
                </div>

                <div className={isTwoCol ? "flex min-h-0 flex-1 gap-3" : "min-h-0 flex-1 space-y-3"}>
                    {isTwoCol && (
                        <div
                            className={cx("space-y-3", isHero ? "p-3" : "p-2")}
                            style={{
                                width: `${s.layout.leftColumnWidth}%`,
                                backgroundColor: `${accent}12`,
                                borderRadius: 6,
                            }}
                        >
                            {SAMPLE_SECTIONS.slice(0, 2).map((section) => (
                                <SectionBlock
                                    key={section.label}
                                    label={section.label}
                                    lines={section.lines}
                                    accent={accent}
                                    text={text}
                                    headingFont={headingFont}
                                    headingsCap={headingsCap}
                                    headingBorderStyle={headingBorderStyle}
                                    letterSpacing={s.headings.letterSpacing}
                                    isHero={isHero}
                                />
                            ))}
                        </div>
                    )}
                    <div className={cx("min-w-0 flex-1", isHero ? "space-y-4" : "space-y-3")}>
                        {(isTwoCol ? SAMPLE_SECTIONS.slice(2) : SAMPLE_SECTIONS).map((section) => (
                            <SectionBlock
                                key={section.label}
                                label={section.label}
                                lines={section.lines}
                                accent={accent}
                                text={text}
                                headingFont={headingFont}
                                headingsCap={headingsCap}
                                headingBorderStyle={headingBorderStyle}
                                letterSpacing={s.headings.letterSpacing}
                                isHero={isHero}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function SectionBlock({
    label,
    lines,
    accent,
    text,
    headingFont,
    headingsCap,
    headingBorderStyle,
    letterSpacing,
    isHero,
}: {
    label: string;
    lines: number[];
    accent: string;
    text: string;
    headingFont: string;
    headingsCap: "uppercase" | "capitalize";
    headingBorderStyle: CSSProperties;
    letterSpacing: number;
    isHero: boolean;
}) {
    return (
        <div>
            <div
                style={{
                    fontFamily: headingFont,
                    fontSize: isHero ? 10 : 8,
                    fontWeight: 700,
                    color: accent,
                    textTransform: headingsCap === "uppercase" ? "uppercase" : "capitalize",
                    letterSpacing: `${Math.max(0, letterSpacing) * 0.5}px`,
                    paddingBottom: isHero ? 3 : 2,
                    marginBottom: isHero ? 7 : 4,
                    ...headingBorderStyle,
                }}
            >
                {label}
            </div>
            <div className={cx(isHero ? "space-y-1.5" : "space-y-1")}>
                {lines.map((width, i) => (
                    <div
                        key={i}
                        style={{
                            height: isHero ? 4 : 3,
                            width: `${width}%`,
                            borderRadius: 999,
                            backgroundColor: `${text}20`,
                        }}
                    />
                ))}
            </div>
        </div>
    );
}
