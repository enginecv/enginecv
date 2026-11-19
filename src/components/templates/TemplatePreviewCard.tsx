"use client";

import { templateDisplayMeta } from "@/lib/templates/template-display";
import { useTranslation } from "@/lib/i18n";
import Link from "next/link";
import { useState } from "react";
import { isBuiltinTemplateId } from "@/lib/templates/enginecv-templates";
import { LiveTemplatePreview } from "./LiveTemplatePreview";
import type { TemplateDocument } from "@/lib/templates/template-schema";

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

    // Built-in templates ship a pre-rendered image. Templates the person made have none,
    // so they are drawn live, the same way the editor draws them.
    if (isBuiltinTemplateId(template.id) && !snapshotFailed) {
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
        <div className={wrapperClass} style={{ backgroundColor: bg }} data-testid="template-live-preview">
            <LiveTemplatePreview template={template} />
        </div>
    );
}
