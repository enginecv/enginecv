"use client";

import { templateDisplayMeta } from "@/lib/templates/template-display";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { TemplatePreviewCard } from "@/components/templates/TemplatePreviewCard";
import { TemplateDeepDive } from "@/components/templates/gallery/TemplateDeepDive";
import { useTemplateResume } from "@/components/templates/useTemplateResume";
import { useTranslation } from "@/lib/i18n";
import { localizedPath } from "@/lib/i18n/locales";
import { GALLERY_PATH, galleryTemplatePath, type GalleryTemplate } from "@/lib/templates/gallery";

export function TemplateDetail({ entry, related }: { entry: GalleryTemplate; related: GalleryTemplate[] }) {
    const { t, locale } = useTranslation();
    const templateAction = useTemplateResume();
    const name = templateDisplayMeta(entry.template, t).name;
    const pending = templateAction.pendingTemplateId !== null;
    const facts = [
        entry.columns === "two" ? t("gallery.factTwoColumns") : t("gallery.factOneColumn"),
        entry.photo ? t("gallery.factPhoto") : t("gallery.factNoPhoto"),
        t("gallery.factText"),
        t("gallery.factFree"),
    ];

    return (
        <>
            <Link
                href={localizedPath(GALLERY_PATH, locale)}
                className="inline-flex items-center gap-1.5 text-sm text-mid transition-colors hover:text-strong"
            >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {t("gallery.backToAll")}
            </Link>

            <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
                <div className="min-w-0">
                    <TemplatePreviewCard template={entry.template} variant="hero" showName={false} priority />
                </div>

                <div className="min-w-0">
                    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("gallery.detailTitle", { name })}</h1>
                    <p className="mt-3 text-base leading-7 text-mid">{t(`gallery.summary.${entry.slug}`)}</p>

                    <button
                        type="button"
                        data-testid="gallery-use-template"
                        disabled={pending}
                        onClick={() => void templateAction.useTemplate(entry.template.id)}
                        className="mt-6 inline-flex h-11 items-center rounded-xl bg-accent px-5 text-sm font-semibold text-surface-2 transition-colors hover:bg-accent-soft disabled:cursor-wait disabled:opacity-80"
                    >
                        {pending ? t("templates.use.creating") : t("templates.use.action")}
                    </button>
                    {templateAction.error && (
                        <p role="alert" className="mt-3 text-sm text-danger-soft">{templateAction.error}</p>
                    )}

                    <h2 className="mt-10 text-lg font-semibold">{t("gallery.suitsHeading")}</h2>
                    <p className="mt-2 text-sm leading-7 text-mid">{t(`gallery.suits.${entry.slug}`)}</p>

                    <h2 className="mt-8 text-lg font-semibold">{t("gallery.factsHeading")}</h2>
                    <ul className="mt-3 space-y-2">
                        {facts.map((fact) => (
                            <li key={fact} className="flex items-start gap-2 text-sm text-mid">
                                <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                                {fact}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <TemplateDeepDive locale={locale} slug={entry.slug} />

            <section className="mt-20" aria-labelledby="gallery-related">
                <h2 id="gallery-related" className="text-xl font-semibold">{t("gallery.related")}</h2>
                <ul className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
                    {related.map((other) => {
                        const href = localizedPath(galleryTemplatePath(other.slug), locale);
                        return (
                            <li key={other.slug}>
                                <TemplatePreviewCard template={other.template} href={href} variant="catalog" showName={false} />
                                <Link href={href} className="mt-3 block text-center text-sm font-medium text-mid hover:text-strong">
                                    {templateDisplayMeta(other.template, t).name}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </section>
        </>
    );
}
