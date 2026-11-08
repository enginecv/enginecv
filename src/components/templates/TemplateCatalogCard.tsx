"use client";

import { useTranslation } from "@/lib/i18n";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { TemplatePreviewCard } from "./TemplatePreviewCard";
import { templateDisplayMeta } from "@/lib/templates/template-display";
import type { TemplateDocument } from "@/lib/templates/template-schema";

export function TemplateCatalogCard({
    template,
    openLabel,
}: {
    template: TemplateDocument;
    openLabel: string;
}) {
    const { t } = useTranslation();
    const meta = templateDisplayMeta(template, t);
    const href = `/templates/${template.id}`;

    return (
        <article
            data-testid="templates-catalog-card"
            className="group rounded-2xl border border-edge bg-surface-4/80 p-4 transition-colors hover:border-faint"
        >
            <TemplatePreviewCard
                template={template}
                href={href}
                variant="catalog"
                showName={false}
                testId="templates-catalog-preview"
            />
            <div className="mt-5 min-w-0">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="truncate text-base font-semibold tracking-tight text-strong">
                            {meta.name}
                        </h2>
                        {meta.description && (
                            <p className="mt-1 line-clamp-2 text-sm leading-6 text-mid">
                                {meta.description}
                            </p>
                        )}
                    </div>
                    <Link
                        href={href}
                        data-testid="templates-catalog-open-template"
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-edge text-bright transition-colors hover:border-accent/60 hover:text-accent"
                        aria-label={`${openLabel}: ${meta.name}`}
                    >
                        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                </div>
                {meta.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                        {meta.tags.slice(0, 4).map((tag) => (
                            <span
                                key={tag}
                                className="rounded-full border border-edge px-2.5 py-1 text-xs text-mid"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </article>
    );
}
