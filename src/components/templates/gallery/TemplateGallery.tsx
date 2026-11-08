"use client";

import { templateDisplayMeta } from "@/lib/templates/template-display";
import Link from "next/link";
import { useState } from "react";
import { TemplatePreviewCard } from "@/components/templates/TemplatePreviewCard";
import { useTranslation } from "@/lib/i18n";
import { localizedPath } from "@/lib/i18n/locales";
import { indexLocales, roleExamplePath } from "@/lib/role-examples/rules";
import { galleryTemplatePath, type GalleryTemplate } from "@/lib/templates/gallery";
import { GalleryFactChips } from "./GalleryFacts";

type Filter = "all" | "one" | "two" | "photo";

function matches(entry: GalleryTemplate, filter: Filter) {
    if (filter === "one" || filter === "two") return entry.columns === filter;
    if (filter === "photo") return entry.photo;
    return true;
}

export function TemplateGallery({ entries }: { entries: GalleryTemplate[] }) {
    const { t, locale } = useTranslation();
    const [filter, setFilter] = useState<Filter>("all");
    const filters: { id: Filter; label: string }[] = [
        { id: "all", label: t("gallery.filterAll") },
        { id: "one", label: t("gallery.filterOneColumn") },
        { id: "two", label: t("gallery.filterTwoColumns") },
        { id: "photo", label: t("gallery.filterPhoto") },
    ];
    const visible = entries.filter((entry) => matches(entry, filter));

    return (
        <>
            <header className="max-w-2xl">
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("gallery.title")}</h1>
                <p className="mt-4 text-base leading-7 text-mid">{t("gallery.intro")}</p>
                {(indexLocales() as string[]).includes(locale) ? (
                    <p className="mt-3 text-sm">
                        <Link href={roleExamplePath(locale)} data-testid="gallery-examples-link" className="text-accent underline underline-offset-2 hover:text-accent-soft">
                            {t("roleExamples.galleryLink")}
                        </Link>
                    </p>
                ) : null}
            </header>

            <div role="group" aria-label={t("gallery.filterLabel")} className="mt-8 flex flex-wrap gap-2">
                {filters.map(({ id, label }) => (
                    <button
                        key={id}
                        type="button"
                        aria-pressed={filter === id}
                        data-testid={`gallery-filter-${id}`}
                        onClick={() => setFilter(id)}
                        className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${filter === id
                            ? "border-accent bg-accent/15 text-accent"
                            : "border-edge text-mid hover:border-faint hover:text-strong"}`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {visible.length === 0 ? (
                <p className="mt-10 text-sm text-faint">{t("gallery.empty")}</p>
            ) : (
                <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {visible.map((entry) => {
                        const href = localizedPath(galleryTemplatePath(entry.slug), locale);
                        return (
                            <li key={entry.slug} data-testid="gallery-card" data-slug={entry.slug} className="rounded-2xl border border-edge bg-surface-4/80 p-4">
                                <TemplatePreviewCard template={entry.template} href={href} variant="catalog" showName={false} />
                                <h2 className="mt-5 text-base font-semibold tracking-tight">
                                    <Link href={href} className="hover:text-accent" aria-label={t("gallery.view", { name: templateDisplayMeta(entry.template, t).name })}>
                                        {templateDisplayMeta(entry.template, t).name}
                                    </Link>
                                </h2>
                                <p className="mt-1 text-sm leading-6 text-mid">{t(`gallery.summary.${entry.slug}`)}</p>
                                <div className="mt-4">
                                    <GalleryFactChips entry={entry} />
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </>
    );
}
